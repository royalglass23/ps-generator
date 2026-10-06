import { describe, expect, it } from "vitest";

import {
  embedCompleteMessage,
  embedContentHeight,
  embedReadyMessage,
  embedResizeMessage,
  embedResumeMessage,
  isEmbedResumeTokenEvent,
} from "../embed-bridge";

describe("PS1 WordPress embed message contract", () => {
  it("describes the iframe height without exposing application data", () => {
    expect(embedResizeMessage(947.8)).toEqual({
      type: "royal-glass-ps1:resize",
      height: 948,
    });
  });

  it("describes the parent-page draft without sending its bearer token", () => {
    expect(embedResumeMessage(
      "11111111-1111-4111-8111-111111111111",
    )).toEqual({
      type: "royal-glass-ps1:resume",
      applicationId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("describes completion so the parent can remove stale resume state", () => {
    expect(embedCompleteMessage()).toEqual({ type: "royal-glass-ps1:complete" });
  });

  it("accepts a resume-token handoff only from the configured WordPress parent", () => {
    const parentWindow = {};
    const event = {
      origin: "https://royalglass.co.nz",
      source: parentWindow,
      data: {
        type: "royal-glass-ps1:resume-token",
        applicationId: "11111111-1111-4111-8111-111111111111",
        token: "secret token",
      },
    };

    expect(embedReadyMessage("11111111-1111-4111-8111-111111111111")).toEqual({
      type: "royal-glass-ps1:ready",
      applicationId: "11111111-1111-4111-8111-111111111111",
    });
    expect(isEmbedResumeTokenEvent(
      event,
      "https://royalglass.co.nz",
      parentWindow,
      "11111111-1111-4111-8111-111111111111",
    )).toBe(true);
    expect(isEmbedResumeTokenEvent(
      { ...event, origin: "https://evil.example" },
      "https://royalglass.co.nz",
      parentWindow,
      "11111111-1111-4111-8111-111111111111",
    )).toBe(false);
  });

  it("reports intrinsic content height when a tall view is replaced by a shorter view", () => {
    const boundary = { scrollHeight: 1480 };
    expect(embedContentHeight(boundary)).toBe(1480);

    boundary.scrollHeight = 720;
    expect(embedContentHeight(boundary)).toBe(720);
  });
});
