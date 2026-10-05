import { and, asc, count, eq, inArray, isNull, lte, or, sum } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { applications, informationRequests, uploads } from "@/lib/db/schema";
import { ApplicationError } from "@/modules/applications/errors";

import type { UploadContext, UploadRecord } from "./upload-service";

function mapUpload(row: typeof uploads.$inferSelect): UploadRecord {
  return {
    id: row.id,
    applicationId: row.applicationId,
    informationRequestId: row.informationRequestId,
    objectKey: row.objectKey,
    originalName: row.originalName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    status: row.status,
  };
}

function contextCondition(context: UploadContext) {
  return context === "initial"
    ? isNull(uploads.informationRequestId)
    : eq(uploads.informationRequestId, context.requestId);
}

export class DrizzleUploadRepository {
  constructor(private readonly db: Database) {}

  async reserve(
    upload: UploadRecord,
    context: UploadContext,
    limits: { maxFiles: number; maxTotalBytes: number },
  ): Promise<UploadRecord> {
    return this.db.transaction(async (transaction) => {
      const [application] = await transaction
        .select({ status: applications.status })
        .from(applications)
        .where(eq(applications.id, upload.applicationId))
        .for("update");
      const allowed =
        application?.status === "draft" ||
        (context !== "initial" && application?.status === "more_information_required");
      if (!allowed) throw new ApplicationError("APPLICATION_LOCKED", "Uploads are not open.");
      if (context !== "initial") {
        const [request] = await transaction
          .select({ id: informationRequests.id })
          .from(informationRequests)
          .where(
            and(
              eq(informationRequests.id, context.requestId),
              eq(informationRequests.applicationId, upload.applicationId),
              eq(informationRequests.status, "open"),
            ),
          );
        if (!request) throw new ApplicationError("INFORMATION_REQUEST_NOT_OPEN", "Uploads are not open.");
      }
      const [usage] = await transaction
        .select({ count: count(), totalBytes: sum(uploads.sizeBytes) })
        .from(uploads)
        .where(
          and(
            eq(uploads.applicationId, upload.applicationId),
            contextCondition(context),
            inArray(uploads.status, ["pending", "ready"]),
          ),
        );
      if ((usage?.count ?? 0) >= limits.maxFiles) {
        throw new ApplicationError("UPLOAD_LIMIT_REACHED", "The upload limit has been reached.");
      }
      if (Number(usage?.totalBytes ?? 0) + upload.sizeBytes > limits.maxTotalBytes) {
        throw new ApplicationError("UPLOAD_TOO_LARGE", "The combined uploads are too large.");
      }
      const [row] = await transaction.insert(uploads).values(upload).returning();
      if (!row) throw new Error("Upload reservation failed.");
      return mapUpload(row);
    });
  }

  async find(id: string, applicationId: string): Promise<UploadRecord | null> {
    const [row] = await this.db
      .select()
      .from(uploads)
      .where(and(eq(uploads.id, id), eq(uploads.applicationId, applicationId)))
      .limit(1);
    return row ? mapUpload(row) : null;
  }

  async markReady(id: string, applicationId: string, context: UploadContext): Promise<UploadRecord> {
    return this.db.transaction(async (transaction) => {
      const [application] = await transaction
        .select({ status: applications.status })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .for("update");
      const allowed =
        application?.status === "draft" ||
        (context !== "initial" && application?.status === "more_information_required");
      if (!allowed) throw new ApplicationError("APPLICATION_LOCKED", "Uploads are not open.");
      const [row] = await transaction
        .update(uploads)
        .set({ status: "ready" })
        .where(
          and(
            eq(uploads.id, id),
            eq(uploads.applicationId, applicationId),
            eq(uploads.status, "pending"),
            contextCondition(context),
          ),
        )
        .returning();
      if (!row) throw new ApplicationError("APPLICATION_NOT_AVAILABLE", "The upload is not available.");
      return mapUpload(row);
    });
  }

  async removePending(id: string, applicationId: string): Promise<UploadRecord | null> {
    const [row] = await this.db
      .delete(uploads)
      .where(
        and(
          eq(uploads.id, id),
          eq(uploads.applicationId, applicationId),
          eq(uploads.status, "pending"),
        ),
      )
      .returning();
    return row ? mapUpload(row) : null;
  }

  async beginCleanup(
    id: string,
    applicationId: string,
  ): Promise<UploadRecord | null> {
    const [claimed] = await this.db
      .update(uploads)
      .set({ status: "cleanup_pending" })
      .where(
        and(
          eq(uploads.id, id),
          eq(uploads.applicationId, applicationId),
          eq(uploads.status, "pending"),
        ),
      )
      .returning();
    if (claimed) return mapUpload(claimed);

    const [existing] = await this.db
      .select()
      .from(uploads)
      .where(
        and(
          eq(uploads.id, id),
          eq(uploads.applicationId, applicationId),
          eq(uploads.status, "cleanup_pending"),
        ),
      )
      .limit(1);
    return existing ? mapUpload(existing) : null;
  }

  async beginCancellation(
    id: string,
    applicationId: string,
    context: UploadContext,
  ): Promise<UploadRecord | null> {
    return this.db.transaction(async (transaction) => {
      const [application] = await transaction
        .select({ status: applications.status })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .for("update");
      const allowed =
        application?.status === "draft" ||
        (context !== "initial" && application?.status === "more_information_required");
      if (!allowed) throw new ApplicationError("APPLICATION_LOCKED", "Uploads are not open.");
      if (context !== "initial") {
        const [request] = await transaction
          .select({ id: informationRequests.id })
          .from(informationRequests)
          .where(
            and(
              eq(informationRequests.id, context.requestId),
              eq(informationRequests.applicationId, applicationId),
              eq(informationRequests.status, "open"),
            ),
          );
        if (!request) throw new ApplicationError("INFORMATION_REQUEST_NOT_OPEN", "Uploads are not open.");
      }

      const [claimed] = await transaction
        .update(uploads)
        .set({ status: "cleanup_pending" })
        .where(
          and(
            eq(uploads.id, id),
            eq(uploads.applicationId, applicationId),
            inArray(uploads.status, ["pending", "ready"]),
            contextCondition(context),
          ),
        )
        .returning();
      if (claimed) return mapUpload(claimed);

      const [existing] = await transaction
        .select()
        .from(uploads)
        .where(
          and(
            eq(uploads.id, id),
            eq(uploads.applicationId, applicationId),
            eq(uploads.status, "cleanup_pending"),
          ),
        )
        .limit(1);
      return existing ? mapUpload(existing) : null;
    });
  }

  async listForCleanup(staleBefore: Date, limit: number): Promise<UploadRecord[]> {
    const rows = await this.db
      .select()
      .from(uploads)
      .where(
        or(
          eq(uploads.status, "cleanup_pending"),
          and(eq(uploads.status, "pending"), lte(uploads.createdAt, staleBefore)),
        ),
      )
      .orderBy(asc(uploads.createdAt))
      .limit(limit);
    return rows.map(mapUpload);
  }

  async finishCleanup(id: string, applicationId: string): Promise<void> {
    await this.db
      .delete(uploads)
      .where(
        and(
          eq(uploads.id, id),
          eq(uploads.applicationId, applicationId),
          eq(uploads.status, "cleanup_pending"),
        ),
      );
  }
}
