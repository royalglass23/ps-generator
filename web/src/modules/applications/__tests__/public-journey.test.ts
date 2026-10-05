import { describe, expect, it, vi } from "vitest";

import {
  buildDraftPayload,
  buildSubmissionPayload,
  contentTypeForUpload,
  createDraftSession,
  initialJourneyState,
  saveForLaterError,
  sendDraftResumeLink,
  type JourneyState,
} from "../public-journey";
import { submissionPayloadSchema } from "../schemas";

const completeState: JourneyState = {
  need: "ps1",
  applicant: {
    name: "Aroha Ngata",
    mobile: "021 555 0101",
    email: "aroha@example.co.nz",
    role: "architect",
  },
  project: {
    address: "28 Example Street",
    city: "Auckland",
    postalCode: "1010",
    buildingConsentNumber: "BC-123",
    resourceConsentNumber: "",
    estimatedInstallation: "3_months",
    stage: "preparing_consent",
  },
  design: { family: "balustrade", system: "side-channel" },
  site: {
    substrate: "timber",
    locations: [{ types: ["deck"], environment: "external", other: "" }],
  },
  acknowledgement: false,
};

describe("public application journey", () => {
  it("starts optional project answers empty and explicit uncertainty answers selected", () => {
    expect(initialJourneyState.project.estimatedInstallation).toBe("not_sure");
    expect(initialJourneyState.project.stage).toBe("");
    expect(initialJourneyState.applicant.role).toBe("");
    expect(initialJourneyState.design.family).toBe("");
    expect(initialJourneyState.site.substrate).toBe("not_sure");
    expect(initialJourneyState.site.locations).toEqual([]);
  });

  it("accepts a quick submission with mandatory contact and address details", () => {
    const quickState: JourneyState = {
      ...completeState,
      applicant: { ...completeState.applicant, role: "" },
      project: {
        ...completeState.project,
        estimatedInstallation: "not_sure",
        stage: "",
      },
      design: { family: "not_sure", system: "not-sure" },
      site: { substrate: "not_sure", locations: [] },
      acknowledgement: true,
    };

    const payload = buildSubmissionPayload(quickState);
    expect(submissionPayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload.applicant.role).toBeUndefined();
    expect(payload.project.stage).toBeUndefined();
    expect(payload.site.locations).toEqual([]);
  });

  it("maps the visible journey to the backend draft and submission contracts", () => {
    expect(buildDraftPayload(completeState)).toEqual({
      need: "ps1",
      applicant: completeState.applicant,
      project: completeState.project,
      design: completeState.design,
      site: completeState.site,
    });

    expect(buildSubmissionPayload({ ...completeState, acknowledgement: true })).toEqual({
      ...buildDraftPayload(completeState),
      acknowledgement: { accepted: true },
    });
  });

  it("creates a draft with the completed Turnstile token", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "draft-1",
          resumeToken: "resume-secret",
          expiresAt: "2026-10-09T00:00:00.000Z",
          resumeUrl: "https://example.test/application/draft-1#token=resume-secret",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(createDraftSession("turnstile-token", fetcher)).resolves.toMatchObject({
      id: "draft-1",
      resumeToken: "resume-secret",
    });
    expect(fetcher).toHaveBeenCalledWith("/api/applications/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken: "turnstile-token" }),
    });
  });

  it("requires applicant contact details before saving for later", () => {
    expect(saveForLaterError(completeState)).toBeNull();
    expect(
      saveForLaterError({
        ...completeState,
        applicant: { ...completeState.applicant, name: "", mobile: "", email: "not-an-email" },
      }),
    ).toBe("Enter your full name, mobile number, and a valid email address before saving for later.");
  });

  it("requests a resume email for the authorized draft", async () => {
    const session = {
      id: "draft-1",
      resumeToken: "resume-secret",
      expiresAt: "2026-10-09T00:00:00.000Z",
      resumeUrl: "https://example.test/application/draft-1#token=resume-secret",
    };
    const fetcher = vi.fn(async () =>
      Response.json({ email: "aroha@example.co.nz", resumeUrl: session.resumeUrl }),
    );

    await expect(sendDraftResumeLink(session, fetcher)).resolves.toEqual({
      email: "aroha@example.co.nz",
      resumeUrl: session.resumeUrl,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/applications/drafts/draft-1/resume-link", {
      method: "POST",
      headers: { Authorization: "Bearer resume-secret" },
    });
  });

  it("supplies the backend DWG content type when the browser leaves it blank", () => {
    expect(contentTypeForUpload({ name: "fixing-section.dwg", type: "" })).toBe("application/dwg");
  });
});
