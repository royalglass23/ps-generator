(function (factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") {
    window.RoyalGlassPs1Bridge = api;
    const initialLocation = api.captureResumeLocation(window);
    const start = function () { api.initialize(document, window, initialLocation); };
    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(function () {
  "use strict";

  const applicationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function buildApplicationUrl(appBaseUrl, search, hash) {
    const base = new URL(appBaseUrl);
    const applicationId = new URLSearchParams(search).get("application");
    const validHash = !hash || /^#token=[^#]{1,1024}$/.test(hash);
    if (!applicationId || !applicationIdPattern.test(applicationId) || !validHash) {
      return base.toString();
    }

    const applicationUrl = new URL(`application/${encodeURIComponent(applicationId)}`, `${base.toString().replace(/\/$/, "")}/`);
    return applicationUrl.toString();
  }

  function captureResumeLocation(browserWindow) {
    const search = browserWindow.location.search;
    const hash = browserWindow.location.hash;
    let handoff = null;
    const applicationId = new URLSearchParams(search).get("application");
    if (applicationIdPattern.test(applicationId || "") && /^#token=[^#]{1,1024}$/.test(hash)) {
      try {
        const token = decodeURIComponent(hash.slice("#token=".length));
        if (token.length >= 1 && token.length <= 1024) {
          handoff = { applicationId, token };
          const cleanUrl = new URL(browserWindow.location.href);
          cleanUrl.hash = "";
          browserWindow.history.replaceState({}, "", cleanUrl.toString());
        }
      } catch {
        handoff = null;
      }
    }
    return { search, handoff };
  }

  function isResizeMessage(value) {
    return Boolean(
      value
      && value.type === "royal-glass-ps1:resize"
      && Number.isFinite(value.height)
      && value.height >= 320
      && value.height <= 10000,
    );
  }

  function isResumeMessage(value) {
    return Boolean(
      value
      && value.type === "royal-glass-ps1:resume"
      && typeof value.applicationId === "string"
      && applicationIdPattern.test(value.applicationId),
    );
  }

  function isCompleteMessage(value) {
    return Boolean(value && value.type === "royal-glass-ps1:complete");
  }

  function isReadyMessage(value) {
    return Boolean(
      value
      && value.type === "royal-glass-ps1:ready"
      && typeof value.applicationId === "string"
      && applicationIdPattern.test(value.applicationId),
    );
  }

  function handleBridgeMessage(event, iframe, appOrigin, browserWindow, handoff) {
    if (event.origin !== appOrigin || event.source !== iframe.contentWindow) return false;

    if (isResizeMessage(event.data)) {
      iframe.style.height = `${Math.ceil(event.data.height)}px`;
      return true;
    }

    if (
      isReadyMessage(event.data)
      && handoff
      && handoff.token
      && event.data.applicationId === handoff.applicationId
    ) {
      iframe.contentWindow.postMessage({
        type: "royal-glass-ps1:resume-token",
        applicationId: handoff.applicationId,
        token: handoff.token,
      }, appOrigin);
      handoff.token = "";
      return true;
    }

    const parentUrl = new URL(browserWindow.location.href);
    if (isResumeMessage(event.data)) {
      parentUrl.searchParams.set("application", event.data.applicationId);
      parentUrl.hash = "";
      browserWindow.history.replaceState({}, "", parentUrl.toString());
      return true;
    }

    if (isCompleteMessage(event.data)) {
      parentUrl.searchParams.delete("application");
      parentUrl.hash = "";
      browserWindow.history.replaceState({}, "", parentUrl.toString());
      return true;
    }

    return false;
  }

  function initialize(doc, browserWindow, initialLocation) {
    doc.querySelectorAll(".rg-ps1-frame").forEach(function (iframe) {
      const appBaseUrl = iframe.dataset.appUrl;
      if (!appBaseUrl) return;

      const appOrigin = new URL(appBaseUrl).origin;
      const location = initialLocation || {
        search: browserWindow.location.search,
        handoff: null,
      };

      browserWindow.addEventListener("message", function (event) {
        handleBridgeMessage(event, iframe, appOrigin, browserWindow, location.handoff);
      });
      iframe.src = buildApplicationUrl(appBaseUrl, location.search, "");
    });
  }

  return {
    buildApplicationUrl,
    captureResumeLocation,
    handleBridgeMessage,
    initialize,
    isCompleteMessage,
    isReadyMessage,
    isResizeMessage,
    isResumeMessage,
  };
});
