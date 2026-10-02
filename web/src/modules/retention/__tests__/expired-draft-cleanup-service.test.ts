import { describe, expect, it } from "vitest";

import { ExpiredDraftCleanupService } from "../expired-draft-cleanup-service";

describe("ExpiredDraftCleanupService", () => {
  it("deletes uploaded objects before deleting an expired draft record", async () => {
    const events: string[] = [];
    const expiresAt = new Date("2026-10-01T00:00:00.000Z");
    const service = new ExpiredDraftCleanupService({
      repository: {
        listExpiredDrafts: async () => [
          { id: "draft-1", expiresAt, objectKeys: ["applications/draft-1/initial/file-1"] },
        ],
        claimExpiredDraft: async () => true,
        deleteClaimedDraft: async () => {
          events.push("database");
        },
      },
      objectStore: {
        delete: async (key) => {
          events.push(`object:${key}`);
        },
      },
      now: () => new Date("2026-10-02T00:00:00.000Z"),
    });

    await expect(service.run()).resolves.toEqual({ deleted: 1, failed: 0 });
    expect(events).toEqual(["object:applications/draft-1/initial/file-1", "database"]);
  });

  it("retains the database record when object deletion fails so cleanup can retry", async () => {
    let databaseDeletes = 0;
    const service = new ExpiredDraftCleanupService({
      repository: {
        listExpiredDrafts: async () => [
          {
            id: "draft-1",
            expiresAt: new Date("2026-10-01T00:00:00.000Z"),
            objectKeys: ["applications/draft-1/initial/file-1"],
          },
        ],
        claimExpiredDraft: async () => true,
        deleteClaimedDraft: async () => {
          databaseDeletes += 1;
        },
      },
      objectStore: { delete: async () => Promise.reject(new Error("R2 unavailable")) },
      now: () => new Date("2026-10-02T00:00:00.000Z"),
    });

    await expect(service.run()).resolves.toEqual({ deleted: 0, failed: 1 });
    expect(databaseDeletes).toBe(0);
  });
});
