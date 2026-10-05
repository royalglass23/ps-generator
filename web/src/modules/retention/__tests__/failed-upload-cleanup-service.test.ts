import { describe, expect, it } from "vitest";

import { FailedUploadCleanupService } from "../failed-upload-cleanup-service";
import type { UploadRecord } from "@/modules/uploads/upload-service";

describe("FailedUploadCleanupService", () => {
  it("retains failed cleanup work and removes it after a later R2 retry succeeds", async () => {
    const uploads = new Map<string, UploadRecord>();
    uploads.set("upload-1", {
      id: "upload-1",
      applicationId: "draft-1",
      informationRequestId: null,
      objectKey: "applications/draft-1/initial/upload-1",
      originalName: "drawing.pdf",
      contentType: "application/pdf",
      sizeBytes: 5,
      status: "cleanup_pending",
    });
    let r2Available = false;
    const service = new FailedUploadCleanupService({
      repository: {
        listForCleanup: async () => [...uploads.values()],
        beginCleanup: async (id) => uploads.get(id) ?? null,
        finishCleanup: async (id) => {
          uploads.delete(id);
        },
      },
      objectStore: {
        delete: async () => {
          if (!r2Available) throw new Error("R2 unavailable");
        },
      },
      now: () => new Date("2026-10-02T00:00:00.000Z"),
    });

    await expect(service.run()).resolves.toEqual({ deleted: 0, failed: 1 });
    expect(uploads.get("upload-1")?.status).toBe("cleanup_pending");

    r2Available = true;
    await expect(service.run()).resolves.toEqual({ deleted: 1, failed: 0 });
    expect(uploads.has("upload-1")).toBe(false);
  });
});
