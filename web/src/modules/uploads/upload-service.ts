import { ApplicationError } from "@/modules/applications/errors";

export type UploadContext = "initial" | { requestId: string };

export interface UploadRecord {
  id: string;
  applicationId: string;
  informationRequestId: string | null;
  objectKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  status: "pending" | "ready";
}

interface UploadServiceDependencies {
  authorize: (
    applicationId: string,
    resumeToken: string,
    requestId?: string,
  ) => Promise<{ applicationId: string; context: UploadContext }>;
  createId: () => string;
  repository: {
    reserve(
      upload: UploadRecord,
      context: UploadContext,
      limits: { maxFiles: number; maxTotalBytes: number },
    ): Promise<UploadRecord>;
    find(id: string, applicationId: string): Promise<UploadRecord | null>;
    markReady(id: string, applicationId: string, context: UploadContext): Promise<UploadRecord>;
    remove(id: string, applicationId: string): Promise<void>;
  };
  objectStore: {
    createUploadUrl(input: {
      key: string;
      contentType: string;
      sizeBytes: number;
    }): Promise<string>;
    inspect(key: string): Promise<{
      sizeBytes: number;
      contentType: string | undefined;
      prefix: Uint8Array;
    }>;
    delete(key: string): Promise<void>;
  };
  maxBytes?: number;
  maxFiles?: number;
  maxTotalBytes?: number;
}

const uploadKinds = {
  "application/pdf": { extensions: [".pdf"], signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  "image/jpeg": { extensions: [".jpg", ".jpeg"], signature: [0xff, 0xd8, 0xff] },
  "image/png": {
    extensions: [".png"],
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  "application/dwg": { extensions: [".dwg"], asciiPrefix: "AC10" },
} as const;

function normalizedContentType(value: string): keyof typeof uploadKinds | null {
  if (value in uploadKinds) return value as keyof typeof uploadKinds;
  if (["application/acad", "image/vnd.dwg", "application/octet-stream"].includes(value)) {
    return "application/dwg";
  }
  return null;
}

function safeFilename(value: string): string {
  const basename = value.replaceAll("\\", "/").split("/").at(-1) ?? "upload";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180);
}

function fileMatches(name: string, contentType: string, prefix?: Uint8Array): boolean {
  const normalized = normalizedContentType(contentType);
  if (!normalized) return false;
  const kind = uploadKinds[normalized];
  const lowerName = name.toLowerCase();
  if (!kind.extensions.some((extension) => lowerName.endsWith(extension))) return false;
  if (!prefix) return true;
  if ("asciiPrefix" in kind) {
    return new TextDecoder("ascii").decode(prefix.slice(0, 4)) === kind.asciiPrefix;
  }
  return kind.signature.every((byte, index) => prefix[index] === byte);
}

function contextPath(context: UploadContext): string {
  return context === "initial" ? "initial" : `information-requests/${context.requestId}`;
}

export class UploadService {
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private readonly maxTotalBytes: number;

  constructor(private readonly dependencies: UploadServiceDependencies) {
    this.maxBytes = dependencies.maxBytes ?? 10 * 1024 * 1024;
    this.maxFiles = dependencies.maxFiles ?? 5;
    this.maxTotalBytes = dependencies.maxTotalBytes ?? 25 * 1024 * 1024;
  }

  async reserve(input: {
    applicationId: string;
    resumeToken: string;
    requestId?: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<{ upload: UploadRecord; uploadUrl: string }> {
    const originalName = safeFilename(input.originalName);
    const contentType = normalizedContentType(input.contentType);
    if (!originalName || !contentType || !fileMatches(originalName, contentType)) {
      throw new ApplicationError("UNSUPPORTED_UPLOAD_TYPE", "This file type is not supported.");
    }
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > this.maxBytes) {
      throw new ApplicationError("UPLOAD_TOO_LARGE", "This file is too large.");
    }
    const authorization = await this.dependencies.authorize(
      input.applicationId,
      input.resumeToken,
      input.requestId,
    );
    const id = this.dependencies.createId();
    const objectKey = `applications/${input.applicationId}/${contextPath(authorization.context)}/${id}`;
    const upload = await this.dependencies.repository.reserve(
      {
        id,
        applicationId: input.applicationId,
        informationRequestId:
          authorization.context === "initial" ? null : authorization.context.requestId,
        objectKey,
        originalName,
        contentType,
        sizeBytes: input.sizeBytes,
        status: "pending",
      },
      authorization.context,
      { maxFiles: this.maxFiles, maxTotalBytes: this.maxTotalBytes },
    );
    try {
      const uploadUrl = await this.dependencies.objectStore.createUploadUrl({
        key: objectKey,
        contentType,
        sizeBytes: input.sizeBytes,
      });
      return { upload, uploadUrl };
    } catch (error) {
      await this.dependencies.repository.remove(id, input.applicationId).catch(() => undefined);
      throw error;
    }
  }

  async complete(input: {
    applicationId: string;
    uploadId: string;
    resumeToken: string;
  }): Promise<UploadRecord> {
    const upload = await this.dependencies.repository.find(input.uploadId, input.applicationId);
    if (!upload) {
      throw new ApplicationError("APPLICATION_NOT_AVAILABLE", "The upload is not available.");
    }
    const requestId = upload.informationRequestId ?? undefined;
    const authorization = await this.dependencies.authorize(
      input.applicationId,
      input.resumeToken,
      requestId,
    );
    try {
      const object = await this.dependencies.objectStore.inspect(upload.objectKey);
      if (
        object.sizeBytes !== upload.sizeBytes ||
        normalizedContentType(object.contentType ?? "") !== upload.contentType ||
        !fileMatches(upload.originalName, upload.contentType, object.prefix)
      ) {
        throw new ApplicationError("UNSUPPORTED_UPLOAD_TYPE", "The uploaded file did not pass validation.");
      }
      return await this.dependencies.repository.markReady(
        upload.id,
        upload.applicationId,
        authorization.context,
      );
    } catch (error) {
      await this.dependencies.objectStore.delete(upload.objectKey).catch(() => undefined);
      await this.dependencies.repository.remove(upload.id, upload.applicationId).catch(() => undefined);
      throw error;
    }
  }
}
