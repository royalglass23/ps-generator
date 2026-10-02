import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { buildSubmissionEmails, escapeHtml } from "@/modules/email/templates";
import type { EmailMessage } from "@/modules/email/types";

import { ApplicationError } from "./errors";
import {
  draftPayloadSchema,
  submissionPayloadSchema,
  type SubmissionPayload,
} from "./schemas";
import type { ApplicationRecord, ApplicationRepository } from "./types";

interface ApplicationServiceDependencies {
  repository: ApplicationRepository;
  now?: () => Date;
  createId?: () => string;
  createToken?: () => string;
  createReference?: (applicationId: string, now: Date) => string;
  draftRetentionDays?: number;
  email?: {
    supportEmail: string;
    serviceM8Email: string;
    internalFromEmail: string;
    applicantFromEmail: string;
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function tokensMatch(token: string, storedHash: string): boolean {
  const supplied = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function defaultReference(applicationId: string, now: Date): string {
  return `PS1-${now.getUTCFullYear()}-${applicationId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function summaryText(payload: SubmissionPayload, uploadNames: string[]): string {
  const locations = payload.site.locations
    .map(
      (location, index) =>
        `Area ${index + 1}: ${location.types.join(", ")} (${location.environment})${location.other ? ` - ${location.other}` : ""}`,
    )
    .join("\n");
  return [
    `Applicant: ${payload.applicant.name}`,
    `Email: ${payload.applicant.email}`,
    `Mobile: ${payload.applicant.mobile}`,
    `Role: ${payload.applicant.role}`,
    `Project address: ${payload.project.address}`,
    `City: ${payload.project.city || "Not provided"}`,
    `Postal code: ${payload.project.postalCode || "Not provided"}`,
    `Building Consent number: ${payload.project.buildingConsentNumber || "Not provided"}`,
    `Resource Consent number: ${payload.project.resourceConsentNumber || "Not provided"}`,
    `Estimated installation: ${payload.project.estimatedInstallation}`,
    `Project stage: ${payload.project.stage}`,
    `Request: ${payload.need}`,
    `Barrier type: ${payload.design.family}`,
    `System: ${payload.design.system}`,
    `Fixing substrate: ${payload.site.substrate}`,
    locations,
    `Uploaded files: ${uploadNames.length ? uploadNames.join(", ") : "None"}`,
    `Application acknowledgement: Confirmed by ${payload.applicant.name}`,
  ].join("\n");
}

export class ApplicationService {
  private readonly repository: ApplicationRepository;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly createToken: () => string;
  private readonly createReference: (applicationId: string, now: Date) => string;
  private readonly draftRetentionDays: number;
  private readonly email: NonNullable<ApplicationServiceDependencies["email"]>;

  constructor(dependencies: ApplicationServiceDependencies) {
    this.repository = dependencies.repository;
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
    this.createToken = dependencies.createToken ?? (() => randomBytes(32).toString("base64url"));
    this.createReference = dependencies.createReference ?? defaultReference;
    this.draftRetentionDays = dependencies.draftRetentionDays ?? 7;
    this.email =
      dependencies.email ??
      ({
        supportEmail: "support@royalglass.co.nz",
        serviceM8Email: "de9f86@inbox.servicem8.com",
        internalFromEmail: "PS1 Generator <support@royalglass.co.nz>",
        applicantFromEmail: "Royal Glass <support@royalglass.co.nz>",
      } as const);
  }

  async createDraft(): Promise<{ id: string; resumeToken: string; expiresAt: Date }> {
    const now = this.now();
    const id = this.createId();
    const resumeToken = this.createToken();
    const expiresAt = addDays(now, this.draftRetentionDays);
    await this.repository.createDraft({
      id,
      reference: null,
      status: "draft",
      resumeTokenHash: hashToken(resumeToken),
      payload: {},
      draftExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      lockedAt: null,
    });
    return { id, resumeToken, expiresAt };
  }

  async getDraft(id: string, resumeToken: string): Promise<ApplicationRecord> {
    return this.authorizeDraft(id, resumeToken);
  }

  async saveDraft(
    id: string,
    resumeToken: string,
    payload: unknown,
  ): Promise<ApplicationRecord> {
    const application = await this.authorize(id, resumeToken);
    if (application.status !== "draft") {
      throw new ApplicationError("APPLICATION_LOCKED", "The submitted application is locked.");
    }
    this.ensureDraftNotExpired(application);
    const parsed = draftPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApplicationError("VALIDATION_FAILED", "The draft data is invalid.", parsed.error.issues);
    }
    const now = this.now();
    return this.repository.updateDraft({
      id,
      payload: parsed.data,
      draftExpiresAt: addDays(now, this.draftRetentionDays),
      updatedAt: now,
    });
  }

  async submit(id: string, resumeToken: string, payload: unknown): Promise<ApplicationRecord> {
    const application = await this.authorize(id, resumeToken);
    if (application.status !== "draft") {
      throw new ApplicationError("APPLICATION_LOCKED", "The submitted application is locked.");
    }
    this.ensureDraftNotExpired(application);
    const parsed = submissionPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        "The application is incomplete or invalid.",
        parsed.error.issues,
      );
    }
    const now = this.now();
    const reference = this.createReference(id, now);
    return this.repository.submit({
      id,
      payload: parsed.data,
      reference,
      submittedAt: now,
      buildMessages: (uploads) =>
        buildSubmissionEmails({
          reference,
          applicantName: parsed.data.applicant.name,
          applicantEmail: parsed.data.applicant.email,
          address: parsed.data.project.address,
          summaryText: summaryText(
            parsed.data,
            uploads.map((upload) => upload.filename),
          ),
          ...this.email,
        }),
    });
  }

  async respondToInformationRequest(
    applicationId: string,
    resumeToken: string,
    requestId: string,
    response: string,
  ): Promise<ApplicationRecord> {
    const application = await this.authorize(applicationId, resumeToken);
    const request = await this.repository.findInformationRequest(requestId, applicationId);
    if (
      application.status !== "more_information_required" ||
      !request ||
      request.status !== "open"
    ) {
      throw new ApplicationError(
        "INFORMATION_REQUEST_NOT_OPEN",
        "This information request is not open.",
      );
    }
    const cleanResponse = response.trim();
    if (!cleanResponse || cleanResponse.length > 5_000) {
      throw new ApplicationError("VALIDATION_FAILED", "The response is invalid.");
    }
    const message: EmailMessage = {
      kind: "information_response_received",
      from: this.email.internalFromEmail,
      to: [this.email.supportEmail, this.email.serviceM8Email],
      replyTo:
        "applicant" in application.payload
          ? (application.payload as SubmissionPayload).applicant.email
          : undefined,
      subject: `PS1 information received - ${application.reference ?? application.id}`,
      text: `The applicant has responded to the More Information Request.\n\n${cleanResponse}`,
      html: `<p>The applicant has responded to the More Information Request.</p><p>${escapeHtml(cleanResponse)}</p>`,
    };
    return this.repository.respondToInformationRequest({
      applicationId,
      requestId,
      response: cleanResponse,
      respondedAt: this.now(),
      message,
    });
  }

  async authorizeForUpload(
    applicationId: string,
    resumeToken: string,
    requestId?: string,
  ): Promise<{ applicationId: string; context: "initial" | { requestId: string } }> {
    const application = await this.authorize(applicationId, resumeToken);
    if (application.status === "draft") {
      this.ensureDraftNotExpired(application);
      return { applicationId, context: "initial" };
    }
    if (requestId && application.status === "more_information_required") {
      const request = await this.repository.findInformationRequest(requestId, applicationId);
      if (request?.status === "open") {
        return { applicationId, context: { requestId } };
      }
    }
    throw new ApplicationError("APPLICATION_LOCKED", "Uploads are not open for this application.");
  }

  private async authorize(id: string, resumeToken: string): Promise<ApplicationRecord> {
    const application = await this.repository.findById(id);
    if (!application || !tokensMatch(resumeToken, application.resumeTokenHash)) {
      throw new ApplicationError(
        "APPLICATION_NOT_AVAILABLE",
        "The application is not available.",
      );
    }
    return application;
  }

  private async authorizeDraft(id: string, resumeToken: string): Promise<ApplicationRecord> {
    const application = await this.authorize(id, resumeToken);
    if (application.status === "expired_draft") {
      throw new ApplicationError(
        "APPLICATION_NOT_AVAILABLE",
        "The application is not available.",
      );
    }
    if (application.status !== "draft") {
      throw new ApplicationError("APPLICATION_LOCKED", "The submitted application is locked.");
    }
    this.ensureDraftNotExpired(application);
    return application;
  }

  private ensureDraftNotExpired(application: ApplicationRecord): void {
    if (!application.draftExpiresAt || application.draftExpiresAt.getTime() <= this.now().getTime()) {
      throw new ApplicationError(
        "APPLICATION_NOT_AVAILABLE",
        "The application is not available.",
      );
    }
  }
}
