import { describe, expect, it, vi } from "vitest";

import { persistAndDispatchOutbox } from "../immediate-outbox-delivery";

describe("persistAndDispatchOutbox", () => {
  it("delivers queued email immediately after the application change is committed", async () => {
    const events: string[] = [];

    const result = await persistAndDispatchOutbox({
      persist: async () => {
        events.push("persisted");
        return { id: "application-1", status: "submitted" };
      },
      dispatch: async () => {
        events.push("dispatched");
        return { sent: 2, failed: 0 };
      },
      onDispatchError: () => undefined,
    });

    expect(result).toEqual({ id: "application-1", status: "submitted" });
    expect(events).toEqual(["persisted", "dispatched"]);
  });

  it("keeps the committed application successful when immediate delivery is unavailable", async () => {
    const deliveryError = new Error("Email provider unavailable");
    const onDispatchError = vi.fn();

    const result = await persistAndDispatchOutbox({
      persist: async () => ({ id: "application-1", status: "submitted" }),
      dispatch: async () => {
        throw deliveryError;
      },
      onDispatchError,
    });

    expect(result).toEqual({ id: "application-1", status: "submitted" });
    expect(onDispatchError).toHaveBeenCalledWith(deliveryError);
  });
});
