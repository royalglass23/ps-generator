import { describe, expect, it, vi } from "vitest";

import {
  buildDraftPayload,
  buildSubmissionPayload,
  contentTypeForUpload,
  createDraftSession,
  type JourneyState,
} from "../public-journey";

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

  it("supplies the backend DWG content type when the browser leaves it blank", () => {
    expect(contentTypeForUpload({ name: "fixing-section.dwg", type: "" })).toBe("application/dwg");
  });
});
