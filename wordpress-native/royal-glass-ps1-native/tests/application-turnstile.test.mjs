import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = {
  RoyalGlassPS1: { turnstileSiteKey: "turnstile-site-key" },
  addEventListener() {},
  scrollY: 0,
};
globalThis.document = {
  querySelectorAll() { return []; },
};
globalThis.sessionStorage = {
  setItem() {},
};
globalThis.location = {
  href: "https://example.test/ps1/",
};
globalThis.history = {
  replaceState() {},
};

const { Ps1Application } = await import("../assets/app.js");

test("the first submit continues after Turnstile completes", async () => {
  const application = Object.create(Ps1Application.prototype);
  application.session = null;
  application.turnstileToken = "";
  application.turnstileFailed = false;
  application.turnstileWaiter = null;
  application.removeTurnstile = () => {};
  application.render = () => {};

  const requests = [];
  application.api = async (path, options) => {
    requests.push({ path, options });
    return {
      id: "draft-1",
      resumeToken: "resume-secret",
      expiresAt: "2026-10-09T00:00:00.000Z",
    };
  };

  const creating = application.ensureSession();
  await Promise.resolve();
  assert.equal(requests.length, 0);

  application.completeTurnstile("turnstile-token");
  await creating;

  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/applications/drafts");
  assert.equal(JSON.parse(requests[0].options.body).turnstileToken, "turnstile-token");
});

test("a Turnstile failure releases the submit and explicit retry starts a fresh wait", async () => {
  const application = Object.create(Ps1Application.prototype);
  application.turnstileToken = "";
  application.turnstileFailed = false;
  application.turnstileWaiter = null;
  application.error = "";
  application.removeTurnstile = () => {};
  application.render = () => {};

  const pending = application.waitForTurnstileToken();
  application.failTurnstile();

  await assert.rejects(pending, /security check could not load/i);
  await assert.rejects(application.waitForTurnstileToken(), /security check could not load/i);

  let failedScriptRemoved = false;
  document.querySelector = () => ({ remove() { failedScriptRemoved = true; } });
  application.retryTurnstile();
  assert.equal(failedScriptRemoved, true);
  document.querySelector = () => null;
  const retried = application.waitForTurnstileToken();
  application.completeTurnstile("retry-token");

  assert.equal(await retried, "retry-token");
});
