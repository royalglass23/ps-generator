import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { DraftPayload, SubmissionPayload } from "@/modules/applications/schemas";
import type { ApplicationStatus } from "@/modules/applications/types";
import type { EmailKind } from "@/modules/email/types";
import type { RateLimitScope } from "@/modules/security/rate-limiter";

export const rateLimits = pgTable(
  "ps1_rate_limits",
  {
    scope: text("scope").$type<RateLimitScope>().notNull(),
    keyHash: text("key_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "date" }).notNull(),
    count: integer("count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.keyHash, table.windowStartedAt] }),
    index("ps1_rate_limits_expiry_idx").on(table.expiresAt),
  ],
);

export const applications = pgTable(
  "ps1_applications",
  {
    id: uuid("id").primaryKey(),
    reference: text("reference"),
    status: text("status").$type<ApplicationStatus>().notNull().default("draft"),
    resumeTokenHash: text("resume_token_hash").notNull(),
    payload: jsonb("payload").$type<DraftPayload | SubmissionPayload>().notNull().default({}),
    draftExpiresAt: timestamp("draft_expires_at", { withTimezone: true, mode: "date" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ps1_applications_reference_unique").on(table.reference),
    index("ps1_applications_status_idx").on(table.status),
    index("ps1_applications_draft_expiry_idx").on(table.draftExpiresAt),
  ],
);

export const informationRequests = pgTable(
  "ps1_information_requests",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    status: text("status").$type<"open" | "responded" | "closed">().notNull().default("open"),
    response: text("response"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("ps1_information_requests_application_idx").on(table.applicationId)],
);

export const uploads = pgTable(
  "ps1_uploads",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    informationRequestId: uuid("information_request_id").references(() => informationRequests.id, {
      onDelete: "cascade",
    }),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    status: text("status")
      .$type<"pending" | "ready" | "cleanup_pending">()
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ps1_uploads_object_key_unique").on(table.objectKey),
    index("ps1_uploads_application_idx").on(table.applicationId),
    index("ps1_uploads_information_request_idx").on(table.informationRequestId),
  ],
);

export const applicationStatusHistory = pgTable(
  "ps1_application_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").$type<ApplicationStatus>(),
    toStatus: text("to_status").$type<ApplicationStatus>().notNull(),
    actorType: text("actor_type").$type<"system" | "applicant" | "staff">().notNull(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("ps1_status_history_application_idx").on(table.applicationId)],
);

export const emailOutbox = pgTable(
  "ps1_email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    kind: text("kind").$type<EmailKind>().notNull(),
    fromAddress: text("from_address").notNull(),
    toAddresses: jsonb("to_addresses").$type<string[]>().notNull(),
    replyTo: text("reply_to"),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body").notNull(),
    attachments: jsonb("attachments")
      .$type<Array<{ objectKey: string; filename: string }>>()
      .notNull()
      .default([]),
    attempts: bigint("attempts", { mode: "number" }).notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    claimToken: text("claim_token"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ps1_email_outbox_pending_idx")
      .on(table.availableAt)
      .where(sql`${table.sentAt} is null`),
  ],
);
