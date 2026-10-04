export type EmailKind =
  | "draft_resume"
  | "internal_submission"
  | "applicant_confirmation"
  | "information_response_received";

export interface EmailMessage {
  kind: EmailKind;
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{ objectKey: string; filename: string }>;
  idempotencyKey?: string;
}
