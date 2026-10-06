const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildApplicationUrl,
  captureResumeLocation,
  handleBridgeMessage,
  isCompleteMessage,
  isResizeMessage,
  isResumeMessage,
} = require("../assets/royal-glass-ps1.js");

test("buildApplicationUrl restores a valid application through the hosted app", () => {
  assert.equal(
    buildApplicationUrl(
      "https://ps1-app.example.test/",
      "?application=11111111-1111-4111-8111-111111111111",
      "#token=secret%20token",
    ),
    "https://ps1-app.example.test/application/11111111-1111-4111-8111-111111111111",
  );
});

test("buildApplicationUrl restores from application-origin session storage without a parent token", () => {
  assert.equal(
    buildApplicationUrl(
      "https://ps1-app.example.test/",
      "?application=11111111-1111-4111-8111-111111111111",
      "",
    ),
    "https://ps1-app.example.test/application/11111111-1111-4111-8111-111111111111",
  );
});

test("buildApplicationUrl ignores malformed application identifiers and fragments", () => {
  assert.equal(
    buildApplicationUrl(
      "https://ps1-app.example.test/",
      "?application=../../admin",
      "#not-a-token=secret",
    ),
    "https://ps1-app.example.test/",
  );
});

test("message validators accept only the documented resize and resume contracts", () => {
  assert.equal(isResizeMessage({ type: "royal-glass-ps1:resize", height: 1024 }), true);
  assert.equal(isResizeMessage({ type: "royal-glass-ps1:resize", height: "1024" }), false);
  assert.equal(isResumeMessage({
    type: "royal-glass-ps1:resume",
    applicationId: "11111111-1111-4111-8111-111111111111",
  }), true);
  assert.equal(isResumeMessage({
    type: "royal-glass-ps1:resume",
    applicationId: "../../admin",
  }), false);
  assert.equal(isCompleteMessage({ type: "royal-glass-ps1:complete" }), true);
});

test("captureResumeLocation removes a valid bearer fragment from the WordPress address bar", () => {
  const replaced = [];
  const browserWindow = {
    location: {
      href: "https://royalglass.co.nz/ps1/?application=11111111-1111-4111-8111-111111111111#token=secret%20token",
      search: "?application=11111111-1111-4111-8111-111111111111",
      hash: "#token=secret%20token",
    },
    history: { replaceState: (_state, _title, url) => replaced.push(url) },
  };

  assert.deepEqual(captureResumeLocation(browserWindow), {
    search: "?application=11111111-1111-4111-8111-111111111111",
    handoff: {
      applicationId: "11111111-1111-4111-8111-111111111111",
      token: "secret token",
    },
  });
  assert.deepEqual(replaced, [
    "https://royalglass.co.nz/ps1/?application=11111111-1111-4111-8111-111111111111",
  ]);
});

test("handleBridgeMessage accepts only the configured iframe and clears parent state on completion", () => {
  const handedOff = [];
  const iframeWindow = { postMessage: (message, origin) => handedOff.push({ message, origin }) };
  const iframe = { contentWindow: iframeWindow, style: {} };
  const replaced = [];
  const browserWindow = {
    location: { href: "https://royalglass.co.nz/ps1/?application=11111111-1111-4111-8111-111111111111" },
    history: { replaceState: (_state, _title, url) => replaced.push(url) },
  };

  assert.equal(handleBridgeMessage({
    origin: "https://evil.example",
    source: iframeWindow,
    data: { type: "royal-glass-ps1:complete" },
  }, iframe, "https://ps1-app.example.test", browserWindow), false);
  assert.equal(handleBridgeMessage({
    origin: "https://ps1-app.example.test",
    source: iframeWindow,
    data: {
      type: "royal-glass-ps1:ready",
      applicationId: "11111111-1111-4111-8111-111111111111",
    },
  }, iframe, "https://ps1-app.example.test", browserWindow, {
    applicationId: "11111111-1111-4111-8111-111111111111",
    token: "secret token",
  }), true);
  assert.deepEqual(handedOff, [{
    message: {
      type: "royal-glass-ps1:resume-token",
      applicationId: "11111111-1111-4111-8111-111111111111",
      token: "secret token",
    },
    origin: "https://ps1-app.example.test",
  }]);
  assert.equal(handleBridgeMessage({
    origin: "https://ps1-app.example.test",
    source: {},
    data: { type: "royal-glass-ps1:complete" },
  }, iframe, "https://ps1-app.example.test", browserWindow), false);
  assert.equal(handleBridgeMessage({
    origin: "https://ps1-app.example.test",
    source: iframeWindow,
    data: { type: "royal-glass-ps1:complete" },
  }, iframe, "https://ps1-app.example.test", browserWindow), true);
  assert.deepEqual(replaced, ["https://royalglass.co.nz/ps1/"]);
});
