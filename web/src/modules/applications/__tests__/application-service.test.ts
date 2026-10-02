import { describe, expect, it } from "vitest";

import { ApplicationService } from "@/modules/applications/application-service";
import { InMemoryApplicationRepository } from "@/test/in-memory-application-repository";

const validSubmission = {
  need: "ps1" as const,
  applicant: {
    name: "Jordan Applicant",
    mobile: "021 555 0101",
    email: "jordan@example.test",
    role: "homeowner" as const,
  },
  project: {
    address: "28 Example Street, Auckland 1010",
    city: "Auckland",
    postalCode: "1010",
    buildingConsentNumber: "",
    resourceConsentNumber: "",
    estimatedInstallation: "3_months" as const,
    stage: "preparing_consent" as const,
  },
  design: {
    family: "balustrade" as const,
    system: "not-sure",
  },
  site: {
    substrate: "timber" as const,
    locations: [
      {
        types: ["deck"],
        environment: "external" as const,
        other: "",
      },
    ],
  },
  acknowledgement: {
    accepted: true as const,
  },
};

function setup() {
  const repository = new InMemoryApplicationRepository();
  let tokenCounter = 0;
  const service = new ApplicationService({
    repository,
    now: () => repository.now,
    createId: () => "11111111-1111-4111-8111-111111111111",
    createToken: () => `resume-token-${++tokenCounter}`,
    createReference: () => "PS1-2026-ABC12345",
    draftRetentionDays: 7,
  });
  return { repository, service };
}

describe("ApplicationService", () => {
  it("creates a draft with a seven-day expiry and stores only the token hash", async () => {
    const { repository, service } = setup();

    const created = await service.createDraft();

    expect(created.resumeToken).toBe("resume-token-1");
    expect(created.expiresAt).toEqual(new Date("2026-10-09T00:00:00.000Z"));
    const stored = repository.applications.get(created.id);
    expect(stored?.resumeTokenHash).not.toContain("resume-token-1");
    expect(stored?.status).toBe("draft");
  });

  it("renews the seven-day expiry whenever an authorized draft is saved", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();
    repository.now = new Date("2026-10-04T03:00:00.000Z");

    const saved = await service.saveDraft(created.id, created.resumeToken, {
      applicant: { name: "Jordan Applicant" },
    });

    expect(saved.draftExpiresAt).toEqual(new Date("2026-10-11T03:00:00.000Z"));
  });

  it("rejects invalid tokens and expired drafts without revealing which check failed", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();

    await expect(service.getDraft(created.id, "wrong-token")).rejects.toMatchObject({
      code: "APPLICATION_NOT_AVAILABLE",
    });

    repository.now = new Date("2026-10-10T00:00:00.000Z");
    await expect(service.getDraft(created.id, created.resumeToken)).rejects.toMatchObject({
      code: "APPLICATION_NOT_AVAILABLE",
    });
  });

  it("submits a complete application, locks it and creates both email outbox messages", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();

    const submitted = await service.submit(created.id, created.resumeToken, validSubmission);

    expect(submitted.status).toBe("submitted");
    expect(submitted.reference).toBe("PS1-2026-ABC12345");
    expect(repository.outbox).toHaveLength(2);
    expect(repository.outbox.map((message) => message.kind).sort()).toEqual([
      "applicant_confirmation",
      "internal_submission",
    ]);
    await expect(
      service.saveDraft(created.id, created.resumeToken, { applicant: { name: "Changed" } }),
    ).rejects.toMatchObject({ code: "APPLICATION_LOCKED" });
  });

  it("includes the full submitted summary and uploaded filenames in both emails", async () => {
    const { repository, service } = setup();
    repository.readyUploads.push({ filename: "fixing-section.pdf" });
    const created = await service.createDraft();

    await service.submit(created.id, created.resumeToken, validSubmission);

    for (const message of repository.outbox) {
      expect(message.text).toContain("City: Auckland");
      expect(message.text).toContain("Estimated installation: 3_months");
      expect(message.text).toContain("Uploaded files: fixing-section.pdf");
      expect(message.text).toContain("Application acknowledgement: Confirmed by Jordan Applicant");
    }
  });

  it("rejects submission when a prototype-required field is missing", async () => {
    const { service } = setup();
    const created = await service.createDraft();

    await expect(
      service.submit(created.id, created.resumeToken, {
        ...validSubmission,
        project: { ...validSubmission.project, address: "" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("accepts additional information only for the matching open staff request", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();
    await service.submit(created.id, created.resumeToken, validSubmission);
    repository.addInformationRequest(created.id, {
      id: "22222222-2222-4222-8222-222222222222",
      message: "Please provide the fixing section.",
    });

    const response = await service.respondToInformationRequest(
      created.id,
      created.resumeToken,
      "22222222-2222-4222-8222-222222222222",
      "The fixing section has been uploaded.",
    );

    expect(response.status).toBe("information_received");
    expect(repository.outbox.at(-1)?.kind).toBe("information_response_received");
    await expect(
      service.respondToInformationRequest(
        created.id,
        created.resumeToken,
        "22222222-2222-4222-8222-222222222222",
        "Duplicate response",
      ),
    ).rejects.toMatchObject({ code: "INFORMATION_REQUEST_NOT_OPEN" });
  });

  it("escapes applicant-supplied information in the internal HTML email", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();
    await service.submit(created.id, created.resumeToken, validSubmission);
    repository.addInformationRequest(created.id, {
      id: "22222222-2222-4222-8222-222222222222",
      message: "Please provide the fixing section.",
    });

    await service.respondToInformationRequest(
      created.id,
      created.resumeToken,
      "22222222-2222-4222-8222-222222222222",
      '<img src=x onerror="alert(1)">',
    );

    expect(repository.outbox.at(-1)?.html).toContain("&lt;img");
    expect(repository.outbox.at(-1)?.html).not.toContain("<img");
  });
});
