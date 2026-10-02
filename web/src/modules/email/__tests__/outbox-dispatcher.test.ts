import { describe, expect, it } from "vitest";

import { OutboxDispatcher, type OutboxJob } from "../outbox-dispatcher";

const job: OutboxJob = {
  id: "email-1",
  claimToken: "claim-1",
  attempts: 1,
  kind: "applicant_confirmation",
  from: "Royal Glass <support@royalglass.co.nz>",
  to: ["applicant@example.test"],
  subject: "Application received",
  text: "Received",
  html: "<p>Received</p>",
};

describe("OutboxDispatcher", () => {
  it("marks a claimed email sent only after the provider accepts it", async () => {
    const events: string[] = [];
    let available: OutboxJob | null = job;
    const dispatcher = new OutboxDispatcher({
      repository: {
        claimNext: async () => {
          const claimed = available;
          available = null;
          return claimed;
        },
        markSent: async () => {
          events.push("sent");
        },
        markFailed: async () => {
          events.push("failed");
        },
      },
      send: async (message) => {
        events.push("provider");
        expect(message.idempotencyKey).toBe("ps1-outbox/email-1");
        return "resend-message-1";
      },
      now: () => new Date("2026-10-02T00:00:00.000Z"),
    });

    await expect(dispatcher.run()).resolves.toEqual({ sent: 1, failed: 0 });
    expect(events).toEqual(["provider", "sent"]);
  });

  it("releases a failed email for a delayed retry", async () => {
    let available: OutboxJob | null = job;
    const failures: Array<{ retryAt: Date; error: string }> = [];
    const dispatcher = new OutboxDispatcher({
      repository: {
        claimNext: async () => {
          const claimed = available;
          available = null;
          return claimed;
        },
        markSent: async () => undefined,
        markFailed: async (_id, _claim, retryAt, error) => {
          failures.push({ retryAt, error });
        },
      },
      send: async () => Promise.reject(new Error("Provider unavailable")),
      now: () => new Date("2026-10-02T00:00:00.000Z"),
    });

    await expect(dispatcher.run()).resolves.toEqual({ sent: 0, failed: 1 });
    expect(failures).toEqual([
      { retryAt: new Date("2026-10-02T00:10:00.000Z"), error: "Provider unavailable" },
    ]);
  });
});
