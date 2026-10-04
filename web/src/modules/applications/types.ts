import type { DraftPayload, SubmissionPayload } from "./schemas";
import type { EmailMessage } from "@/modules/email/types";

export const applicationStatuses = [
  "draft",
  "expired_draft",
  "submitted",
  "under_review",
  "more_information_required",
  "information_received",
  "converted_to_job",
  "declined",
  "archived",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export interface ApplicationRecord {
  id: string;
  reference: string | null;
  status: ApplicationStatus;
  resumeTokenHash: string;
  payload: DraftPayload | SubmissionPayload;
  draftExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  lockedAt: Date | null;
}

export interface InformationRequestRecord {
  id: string;
  applicationId: string;
  message: string;
  status: "open" | "responded" | "closed";
  response: string | null;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface ApplicationRepository {
  createDraft(application: ApplicationRecord): Promise<void>;
  findById(id: string): Promise<ApplicationRecord | null>;
  updateDraft(input: {
    id: string;
    payload: DraftPayload;
    draftExpiresAt: Date;
    updatedAt: Date;
  }): Promise<ApplicationRecord>;
  enqueueEmail(applicationId: string, message: EmailMessage): Promise<void>;
  submit(input: {
    id: string;
    payload: SubmissionPayload;
    reference: string;
    submittedAt: Date;
    buildMessages: (uploads: Array<{ filename: string }>) => EmailMessage[];
  }): Promise<ApplicationRecord>;
  findInformationRequest(id: string, applicationId: string): Promise<InformationRequestRecord | null>;
  respondToInformationRequest(input: {
    applicationId: string;
    requestId: string;
    response: string;
    respondedAt: Date;
    message: EmailMessage;
  }): Promise<ApplicationRecord>;
}
