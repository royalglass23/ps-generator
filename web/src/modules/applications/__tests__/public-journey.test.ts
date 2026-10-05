import { describe, expect, it, vi } from "vitest";

import {
  buildDraftPayload,
  buildSubmissionPayload,
  contentTypeForUpload,
  createDraftSession,
  applicantDetailsError,
  initialJourneyState,
  loadDraft,
  sendDraftResumeLink,
  uploadApplicationFile,
  type JourneyState,
} from "../public-journey";
import { draftPayloadSchema, submissionPayloadSchema } from "../schemas";

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
  it("starts with the intended defaults and optional project answers empty", () => {
    expect(initialJourneyState.project.estimatedInstallation).toBe("not_sure");
    expect(initialJourneyState.project.stage).toBe("");
    expect(initialJourneyState.applicant.role).toBe("");
    expect(initialJourneyState.design.family).toBe("balustrade");
    expect(initialJourneyState.site.substrate).toBe("not_sure");
    expect(initialJourneyState.site.locations).toEqual([]);
  });

  it("accepts a quick submission with mandatory contact and address details", () => {
    const quickState: JourneyState = {
      ...completeState,
      applicant: { ...completeState.applicant, role: "homeowner" },
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
    expect(payload.applicant.role).toBe("homeowner");
    expect(payload.project.stage).toBeUndefined();
    expect(payload.site.locations).toEqual([]);
  });

  it("rejects a final submission without an applicant role", () => {
    expect(() => buildSubmissionPayload({
      ...completeState,
      applicant: { ...completeState.applicant, role: "" },
      acknowledgement: true,
    })).toThrow("Select your role in the project before submitting.");
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

  it("drops removed city and postal-code keys when restoring a legacy draft", async () => {
    const fetcher = vi.fn(async () => Response.json({
      payload: {
        ...buildDraftPayload(completeState),
        project: {
          ...buildDraftPayload(completeState).project,
          city: "Auckland",
          postalCode: "1010",
        },
      },
    }));

    const restored = await loadDraft("draft-1", "resume-secret", fetcher);
    const rebuilt = buildDraftPayload(restored);

    expect(rebuilt.project).not.toHaveProperty("city");
    expect(rebuilt.project).not.toHaveProperty("postalCode");
    expect(draftPayloadSchema.safeParse(rebuilt).success).toBe(true);
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

  it("requires valid applicant contact details", () => {
    expect(applicantDetailsError(completeState)).toBeNull();
    expect(
      applicantDetailsError({
        ...completeState,
        applicant: { ...completeState.applicant, name: "", mobile: "", email: "not-an-email" },
      }),
    ).toBe("Enter your full name, NZ phone number, and email address.");
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

  it("cancels a reserved upload when the direct R2 upload fails", async () => {
    const session = {
      id: "draft-1",
      resumeToken: "resume-secret",
      expiresAt: "2026-10-09T00:00:00.000Z",
      resumeUrl: "https://example.test/application/draft-1#token=resume-secret",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        id: "upload-1",
        uploadUrl: "https://r2.example.test/signed-upload",
        headers: { "Content-Type": "application/pdf" },
      }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const file = new File(["%PDF-"], "drawing.pdf", { type: "application/pdf" });

    await expect(uploadApplicationFile(session, file, fetcher)).rejects.toThrow(
      "The file could not be uploaded. Try again.",
    );
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/applications/drafts/draft-1/uploads/upload-1",
      {
        method: "DELETE",
        headers: { Authorization: "Bearer resume-secret" },
      },
    );
  });
});
