import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import {
  applications,
  applicationStatusHistory,
  emailOutbox,
  informationRequests,
  uploads,
} from "@/lib/db/schema";
import type { EmailMessage } from "@/modules/email/types";
import { ApplicationError } from "./errors";

import type { DraftPayload, SubmissionPayload } from "./schemas";
import type {
  ApplicationRecord,
  ApplicationRepository,
  InformationRequestRecord,
} from "./types";

function mapApplication(row: typeof applications.$inferSelect): ApplicationRecord {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    resumeTokenHash: row.resumeTokenHash,
    payload: row.payload,
    draftExpiresAt: row.draftExpiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    submittedAt: row.submittedAt,
    lockedAt: row.lockedAt,
  };
}

function mapRequest(row: typeof informationRequests.$inferSelect): InformationRequestRecord {
  return {
    id: row.id,
    applicationId: row.applicationId,
    message: row.message,
    status: row.status,
    response: row.response,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
  };
}

function outboxRows(
  applicationId: string,
  messages: EmailMessage[],
  attachments: Array<{ objectKey: string; filename: string }> = [],
) {
  return messages.map((message) => ({
    applicationId,
    kind: message.kind,
    fromAddress: message.from,
    toAddresses: message.to,
    replyTo: message.replyTo ?? null,
    subject: message.subject,
    textBody: message.text,
    htmlBody: message.html,
    attachments:
      message.kind === "applicant_confirmation" ? (message.attachments ?? []) : attachments,
  }));
}

export class DrizzleApplicationRepository implements ApplicationRepository {
  constructor(private readonly db: Database) {}

  async createDraft(application: ApplicationRecord): Promise<void> {
    await this.db.insert(applications).values(application);
    await this.db.insert(applicationStatusHistory).values({
      applicationId: application.id,
      fromStatus: null,
      toStatus: "draft",
      actorType: "applicant",
    });
  }

  async findById(id: string): Promise<ApplicationRecord | null> {
    const [row] = await this.db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return row ? mapApplication(row) : null;
  }

  async updateDraft(input: {
    id: string;
    payload: DraftPayload;
    draftExpiresAt: Date;
    updatedAt: Date;
  }): Promise<ApplicationRecord> {
    const [row] = await this.db
      .update(applications)
      .set({
        payload: input.payload,
        draftExpiresAt: input.draftExpiresAt,
        updatedAt: input.updatedAt,
      })
      .where(and(eq(applications.id, input.id), eq(applications.status, "draft")))
      .returning();
    if (!row) throw new Error("Draft update lost its status precondition.");
    return mapApplication(row);
  }

  async submit(input: {
    id: string;
    payload: SubmissionPayload;
    reference: string;
    submittedAt: Date;
    buildMessages: (uploads: Array<{ filename: string }>) => EmailMessage[];
  }): Promise<ApplicationRecord> {
    return this.db.transaction(async (transaction) => {
      const [row] = await transaction
        .update(applications)
        .set({
          payload: input.payload,
          reference: input.reference,
          status: "submitted",
          draftExpiresAt: null,
          submittedAt: input.submittedAt,
          lockedAt: input.submittedAt,
          updatedAt: input.submittedAt,
        })
        .where(and(eq(applications.id, input.id), eq(applications.status, "draft")))
        .returning();
      if (!row) throw new Error("Submission lost its draft status precondition.");
      const [pendingUpload] = await transaction
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.applicationId, input.id),
            isNull(uploads.informationRequestId),
            eq(uploads.status, "pending"),
          ),
        )
        .limit(1);
      if (pendingUpload) {
        throw new ApplicationError(
          "VALIDATION_FAILED",
          "Wait for all uploads to finish before submitting.",
        );
      }
      await transaction.insert(applicationStatusHistory).values({
        applicationId: input.id,
        fromStatus: "draft",
        toStatus: "submitted",
        actorType: "applicant",
      });
      const storedUploads = await transaction
        .select({ objectKey: uploads.objectKey, filename: uploads.originalName })
        .from(uploads)
        .where(
          and(
            eq(uploads.applicationId, input.id),
            isNull(uploads.informationRequestId),
            eq(uploads.status, "ready"),
          ),
        );
      const messages = input.buildMessages(storedUploads);
      await transaction
        .insert(emailOutbox)
        .values(outboxRows(input.id, messages, storedUploads));
      return mapApplication(row);
    });
  }

  async findInformationRequest(
    id: string,
    applicationId: string,
  ): Promise<InformationRequestRecord | null> {
    const [row] = await this.db
      .select()
      .from(informationRequests)
      .where(
        and(eq(informationRequests.id, id), eq(informationRequests.applicationId, applicationId)),
      )
      .limit(1);
    return row ? mapRequest(row) : null;
  }

  async respondToInformationRequest(input: {
    applicationId: string;
    requestId: string;
    response: string;
    respondedAt: Date;
    message: EmailMessage;
  }): Promise<ApplicationRecord> {
    return this.db.transaction(async (transaction) => {
      const [request] = await transaction
        .update(informationRequests)
        .set({ status: "responded", response: input.response, respondedAt: input.respondedAt })
        .where(
          and(
            eq(informationRequests.id, input.requestId),
            eq(informationRequests.applicationId, input.applicationId),
            eq(informationRequests.status, "open"),
          ),
        )
        .returning();
      if (!request) throw new Error("Information request lost its open status precondition.");
      const [application] = await transaction
        .update(applications)
        .set({ status: "information_received", updatedAt: input.respondedAt })
        .where(
          and(
            eq(applications.id, input.applicationId),
            eq(applications.status, "more_information_required"),
          ),
        )
        .returning();
      if (!application) throw new Error("Application lost its information-request precondition.");
      const [pendingUpload] = await transaction
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.applicationId, input.applicationId),
            eq(uploads.informationRequestId, input.requestId),
            eq(uploads.status, "pending"),
          ),
        )
        .limit(1);
      if (pendingUpload) {
        throw new ApplicationError(
          "VALIDATION_FAILED",
          "Wait for all uploads to finish before responding.",
        );
      }
      const requestUploads = await transaction
        .select({ objectKey: uploads.objectKey, filename: uploads.originalName })
        .from(uploads)
        .where(
          and(
            eq(uploads.applicationId, input.applicationId),
            eq(uploads.informationRequestId, input.requestId),
            eq(uploads.status, "ready"),
          ),
        );
      await transaction.insert(applicationStatusHistory).values({
        applicationId: input.applicationId,
        fromStatus: "more_information_required",
        toStatus: "information_received",
        actorType: "applicant",
      });
      await transaction
        .insert(emailOutbox)
        .values(outboxRows(input.applicationId, [input.message], requestUploads));
      return mapApplication(application);
    });
  }
}
