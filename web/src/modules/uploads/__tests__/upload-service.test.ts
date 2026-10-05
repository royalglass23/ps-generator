import { describe, expect, it } from "vitest";

import { UploadService, type UploadRecord } from "@/modules/uploads/upload-service";

function setup(
  prefix = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
  deleteObject: () => Promise<void> = async () => undefined,
) {
  const uploads = new Map<string, UploadRecord>();
  const service = new UploadService({
    authorize: async () => ({ applicationId: "app-123", context: "initial" }),
    createId: () => "upload-456",
    repository: {
      reserve: async (upload) => {
        uploads.set(upload.id, upload);
        return upload;
      },
      find: async (id) => uploads.get(id) ?? null,
      markReady: async (id) => {
        const ready = { ...uploads.get(id)!, status: "ready" as const };
        uploads.set(id, ready);
        return ready;
      },
      removePending: async (id) => {
        const upload = uploads.get(id);
        if (!upload || upload.status !== "pending") return null;
        uploads.delete(id);
        return upload;
      },
      beginCleanup: async (id) => {
        const upload = uploads.get(id);
        if (!upload || upload.status === "ready") return null;
        const candidate = { ...upload, status: "cleanup_pending" as const };
        uploads.set(id, candidate);
        return candidate;
      },
      finishCleanup: async (id) => {
        if (uploads.get(id)?.status === "cleanup_pending") uploads.delete(id);
      },
    },
    objectStore: {
      createUploadUrl: async () => "https://r2.example.test/signed-upload",
      inspect: async () => ({
        sizeBytes: 5,
        contentType: "application/pdf",
        prefix,
      }),
      delete: deleteObject,
    },
  });
  return { service, uploads };
}

describe("UploadService", () => {
  it("reserves an opaque R2 key and returns a direct upload URL", async () => {
    const { service } = setup();
    const result = await service.reserve({
      applicationId: "app-123",
      resumeToken: "secret",
      originalName: "Jordan Applicant fixing detail.pdf",
      contentType: "application/pdf",
      sizeBytes: 5,
    });

    expect(result.upload.objectKey).toBe("applications/app-123/initial/upload-456");
    expect(result.upload.objectKey).not.toContain("Jordan");
    expect(result.uploadUrl).toContain("signed-upload");
  });

  it("normalizes attachment filenames and rejects unsupported metadata", async () => {
    const { service } = setup();
    const reserved = await service.reserve({
      applicationId: "app-123",
      resumeToken: "secret",
      originalName: "C:\\fakepath\\drawing.pdf",
      contentType: "application/pdf",
      sizeBytes: 5,
    });
    expect(reserved.upload.originalName).toBe("drawing.pdf");

    await expect(
      service.reserve({
        applicationId: "app-123",
        resumeToken: "secret",
        originalName: "malware.exe",
        contentType: "application/x-msdownload",
        sizeBytes: 1,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_UPLOAD_TYPE" });
  });

  it("validates object size, content type and signature before marking it ready", async () => {
    const { service } = setup();
    await service.reserve({
      applicationId: "app-123",
      resumeToken: "secret",
      originalName: "drawing.pdf",
      contentType: "application/pdf",
      sizeBytes: 5,
    });

    await expect(
      service.complete({ applicationId: "app-123", uploadId: "upload-456", resumeToken: "secret" }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("deletes a disguised object and its reservation", async () => {
    const { service, uploads } = setup(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]));
    await service.reserve({
      applicationId: "app-123",
      resumeToken: "secret",
      originalName: "drawing.pdf",
      contentType: "application/pdf",
      sizeBytes: 5,
    });

    await expect(
      service.complete({ applicationId: "app-123", uploadId: "upload-456", resumeToken: "secret" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_UPLOAD_TYPE" });
    expect(uploads.size).toBe(0);
  });

  it("cancels an authorized pending reservation after a direct upload failure", async () => {
    const { service, uploads } = setup();
    await service.reserve({
      applicationId: "app-123",
      resumeToken: "secret",
      originalName: "drawing.pdf",
      contentType: "application/pdf",
      sizeBytes: 5,
    });

    await expect(
      service.cancel({ applicationId: "app-123", uploadId: "upload-456", resumeToken: "secret" }),
    ).resolves.toBeUndefined();
    expect(uploads.size).toBe(0);
  });

  it("retains durable cleanup work when R2 deletion fails during cancellation", async () => {
    const { service, uploads } = setup(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      async () => Promise.reject(new Error("R2 unavailable")),
    );
    await service.reserve({
      applicationId: "app-123",
      resumeToken: "secret",
      originalName: "drawing.pdf",
      contentType: "application/pdf",
      sizeBytes: 5,
    });

    await expect(
      service.cancel({ applicationId: "app-123", uploadId: "upload-456", resumeToken: "secret" }),
    ).resolves.toBeUndefined();
    expect(uploads.get("upload-456")?.status).toBe("cleanup_pending");
  });
});
