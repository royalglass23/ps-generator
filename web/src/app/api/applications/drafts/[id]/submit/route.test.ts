import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  dispatchEmailOutboxSafely: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));

vi.mock("@/modules/applications/runtime", () => ({
  getApplicationService: () => ({ submit: mocks.submit }),
}));

vi.mock("@/modules/email/runtime", () => ({
  dispatchEmailOutboxSafely: mocks.dispatchEmailOutboxSafely,
}));

import { POST } from "./route";

describe("submit application route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the durable submission before dispatching its queued emails", async () => {
    const events: string[] = [];
    let scheduledTask: (() => void | Promise<void>) | undefined;
    mocks.after.mockImplementation((task: () => void | Promise<void>) => {
      events.push("scheduled");
      scheduledTask = task;
    });
    mocks.submit.mockImplementation(async () => {
      events.push("persisted");
      return {
        id: "application-1",
        status: "submitted",
        reference: "PS1-2026-ABC12345",
        submittedAt: new Date("2026-10-05T01:23:45.000Z"),
      };
    });

    const response = await POST(
      new Request("https://example.test/api/applications/drafts/application-1/submit", {
        method: "POST",
        headers: {
          Authorization: "Bearer resume-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ acknowledgement: true }),
      }),
      { params: Promise.resolve({ id: "application-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "application-1",
      status: "submitted",
      reference: "PS1-2026-ABC12345",
      submittedAt: "2026-10-05T01:23:45.000Z",
    });
    expect(events).toEqual(["persisted", "scheduled"]);
    expect(mocks.dispatchEmailOutboxSafely).not.toHaveBeenCalled();

    expect(scheduledTask).toBeTypeOf("function");
    await scheduledTask?.();
    expect(mocks.dispatchEmailOutboxSafely).toHaveBeenCalledOnce();
  });
});
