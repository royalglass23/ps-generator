import type { EmailMessage } from "@/modules/email/types";
import type { DraftPayload, SubmissionPayload } from "@/modules/applications/schemas";
import type {
  ApplicationRecord,
  ApplicationRepository,
  InformationRequestRecord,
} from "@/modules/applications/types";

export class InMemoryApplicationRepository implements ApplicationRepository {
  readonly applications = new Map<string, ApplicationRecord>();
  readonly informationRequests = new Map<string, InformationRequestRecord>();
  readonly outbox: EmailMessage[] = [];
  readonly readyUploads: Array<{ filename: string }> = [];
  now = new Date("2026-10-02T00:00:00.000Z");

  async createDraft(application: ApplicationRecord): Promise<void> {
    this.applications.set(application.id, structuredClone(application));
  }

  async findById(id: string): Promise<ApplicationRecord | null> {
    const application = this.applications.get(id);
    return application ? structuredClone(application) : null;
  }

  async updateDraft(input: {
    id: string;
    payload: DraftPayload;
    draftExpiresAt: Date;
    updatedAt: Date;
  }): Promise<ApplicationRecord> {
    const application = this.requireApplication(input.id);
    const updated: ApplicationRecord = {
      ...application,
      payload: structuredClone(input.payload),
      draftExpiresAt: input.draftExpiresAt,
      updatedAt: input.updatedAt,
    };
    this.applications.set(input.id, updated);
    return structuredClone(updated);
  }

  async enqueueEmail(_applicationId: string, message: EmailMessage): Promise<void> {
    this.outbox.push(structuredClone(message));
  }

  async submit(input: {
    id: string;
    payload: SubmissionPayload;
    reference: string;
    submittedAt: Date;
    buildMessages: (uploads: Array<{ filename: string }>) => EmailMessage[];
  }): Promise<ApplicationRecord> {
    const application = this.requireApplication(input.id);
    const updated: ApplicationRecord = {
      ...application,
      payload: structuredClone(input.payload),
      reference: input.reference,
      status: "submitted",
      draftExpiresAt: null,
      submittedAt: input.submittedAt,
      lockedAt: input.submittedAt,
      updatedAt: input.submittedAt,
    };
    this.applications.set(input.id, updated);
    this.outbox.push(...structuredClone(input.buildMessages(this.readyUploads)));
    return structuredClone(updated);
  }

  async findInformationRequest(
    id: string,
    applicationId: string,
  ): Promise<InformationRequestRecord | null> {
    const request = this.informationRequests.get(id);
    return request?.applicationId === applicationId ? structuredClone(request) : null;
  }

  async respondToInformationRequest(input: {
    applicationId: string;
    requestId: string;
    response: string;
    respondedAt: Date;
    message: EmailMessage;
  }): Promise<ApplicationRecord> {
    const application = this.requireApplication(input.applicationId);
    const request = this.informationRequests.get(input.requestId);
    if (!request) throw new Error("Information request missing");
    this.informationRequests.set(input.requestId, {
      ...request,
      status: "responded",
      response: input.response,
      respondedAt: input.respondedAt,
    });
    const updated: ApplicationRecord = {
      ...application,
      status: "information_received",
      updatedAt: input.respondedAt,
    };
    this.applications.set(input.applicationId, updated);
    this.outbox.push(structuredClone(input.message));
    return structuredClone(updated);
  }

  addInformationRequest(
    applicationId: string,
    request: { id: string; message: string },
  ): void {
    const application = this.requireApplication(applicationId);
    this.applications.set(applicationId, {
      ...application,
      status: "more_information_required",
      updatedAt: this.now,
    });
    this.informationRequests.set(request.id, {
      id: request.id,
      applicationId,
      message: request.message,
      status: "open",
      response: null,
      createdAt: this.now,
      respondedAt: null,
    });
  }

  private requireApplication(id: string): ApplicationRecord {
    const application = this.applications.get(id);
    if (!application) throw new Error(`Application ${id} does not exist`);
    return application;
  }
}
