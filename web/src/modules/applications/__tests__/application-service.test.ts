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
    draftRetentionHours: 24,
    applicationBaseUrl: "https://ps1.example.test",
  });
  return { repository, service };
}

describe("ApplicationService", () => {
  it("creates a draft with a 24-hour expiry and stores only the token hash", async () => {
    const { repository, service } = setup();

    const created = await service.createDraft();

    expect(created.resumeToken).toBe("resume-token-1");
    expect(created.expiresAt).toEqual(new Date("2026-10-03T00:00:00.000Z"));
    const stored = repository.applications.get(created.id);
    expect(stored?.resumeTokenHash).not.toContain("resume-token-1");
    expect(stored?.status).toBe("draft");
  });

  it("does not load email configuration until an email-producing action", async () => {
    const repository = new InMemoryApplicationRepository();
    const service = new ApplicationService({
      repository,
      now: () => repository.now,
      createId: () => "11111111-1111-4111-8111-111111111111",
      createToken: () => "resume-token-1",
      email: () => {
        throw new Error("Invalid email configuration");
      },
    });

    const created = await service.createDraft();

    await expect(
      service.saveDraft(created.id, created.resumeToken, {
        applicant: { name: "Jordan Applicant", mobile: "021 555 0101", email: "jordan@example.test" },
      }),
    ).resolves.toMatchObject({ status: "draft" });
    await expect(service.submit(created.id, created.resumeToken, validSubmission)).rejects.toThrow(
      "Invalid email configuration",
    );
  });

  it("renews the 24-hour expiry whenever an authorized draft is saved", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();
    repository.now = new Date("2026-10-02T03:00:00.000Z");

    const saved = await service.saveDraft(created.id, created.resumeToken, {
      applicant: { name: "Jordan Applicant" },
    });

    expect(saved.draftExpiresAt).toEqual(new Date("2026-10-03T03:00:00.000Z"));
  });

  it("emails the applicant a secure resume link for an explicitly saved draft", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();
    await service.saveDraft(created.id, created.resumeToken, {
      applicant: {
        name: "Jordan Applicant",
        mobile: "021 555 0101",
        email: "jordan@example.test",
      },
    });

    await service.sendDraftResumeLink(created.id, created.resumeToken);

    expect(repository.outbox).toHaveLength(1);
    expect(repository.outbox[0]).toMatchObject({
      kind: "draft_resume",
      to: ["jordan@example.test"],
      subject: "Continue your Royal Glass PS1 application",
    });
    expect(repository.outbox[0]?.text).toContain(
      `https://ps1.example.test/application/${created.id}#token=${encodeURIComponent(created.resumeToken)}`,
    );
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

  it("caps legacy draft records at 24 hours from their latest save", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();
    const stored = repository.applications.get(created.id)!;
    repository.applications.set(created.id, {
      ...stored,
      draftExpiresAt: new Date("2026-10-09T00:00:00.000Z"),
    });
    repository.now = new Date("2026-10-03T00:00:01.000Z");

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
      expect(message.text).toContain("Role: Homeowner");
      expect(message.text).toContain("Estimated installation: Within 3 months");
      expect(message.text).toContain("Project stage: Preparing Building Consent");
      expect(message.text).toContain("Request: I need a PS1");
      expect(message.text).toContain("Barrier type: Glass balustrade");
      expect(message.text).toContain("System: Not sure");
      expect(message.text).toContain("Fixing substrate: Timber");
      expect(message.text).toContain("Area 1: Deck (External)");
      expect(message.text).not.toContain("3_months");
      expect(message.text).not.toContain("preparing_consent");
      expect(message.text).toContain("Uploaded files: fixing-section.pdf");
      expect(message.text).toContain("Application acknowledgement: Confirmed by Jordan Applicant");
    }
  });

  it("uses display labels instead of stored codes for the submitted choices", async () => {
    const { repository, service } = setup();
    const created = await service.createDraft();

    await service.submit(created.id, created.resumeToken, {
      ...validSubmission,
      applicant: { ...validSubmission.applicant, role: "architect" },
      project: {
        ...validSubmission.project,
        estimatedInstallation: "not_sure",
        stage: undefined,
      },
      design: { family: "balustrade", system: "side-channel" },
      site: {
        substrate: "not_sure",
        locations: [{ types: ["balcony"], environment: "external", other: "" }],
      },
    });

    for (const message of repository.outbox) {
      expect(message.text).toContain("Role: Architect / Designer");
      expect(message.text).toContain("Estimated installation: Not sure");
      expect(message.text).toContain("Project stage: Not provided");
      expect(message.text).toContain("Request: I need a PS1");
      expect(message.text).toContain("Barrier type: Glass balustrade");
      expect(message.text).toContain("System: Side Mount Channel");
      expect(message.text).toContain("Fixing substrate: Not sure");
      expect(message.text).toContain("Area 1: Balcony (External)");
      expect(message.text).not.toContain("not_sure");
      expect(message.text).not.toContain("side-channel");
      expect(message.html).toContain("Side Mount Channel");
      expect(message.html).toContain("Not sure");
      expect(message.html).not.toContain("not_sure");
      expect(message.html).not.toContain("side-channel");
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
