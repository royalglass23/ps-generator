import { describe, expect, it } from "vitest";

import { draftPayloadSchema, informationResponseSchema, submissionPayloadSchema } from "../schemas";

const validSubmission = {
  need: "ps1",
  applicant: {
    name: "Aroha Ngāta",
    mobile: "+64 21 555 0101",
    email: "aroha@example.co.nz",
    role: "architect",
  },
  project: {
    address: "28 Example Street, Auckland 1010",
    buildingConsentNumber: "BC-123/2026",
    resourceConsentNumber: "",
    estimatedInstallation: "3_months",
    stage: "preparing_consent",
  },
  design: { family: "balustrade", system: "side-channel" },
  site: {
    substrate: "timber",
    locations: [{ types: ["deck"], environment: "external", other: "" }],
  },
  acknowledgement: { accepted: true },
};

describe("application input schemas", () => {
  it("accepts legitimate Unicode names, NZ phones, emails and project references", () => {
    const parsed = submissionPayloadSchema.safeParse({
      ...validSubmission,
      applicant: { ...validSubmission.applicant, email: "Aroha@EXAMPLE.CO.NZ" },
      project: { ...validSubmission.project, buildingConsentNumber: "bc-123/2026" },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected submission to parse.");
    expect(parsed.data.applicant.email).toBe("Aroha@example.co.nz");
    expect(parsed.data.project.buildingConsentNumber).toBe("BC-123/2026");
    expect(
      submissionPayloadSchema.safeParse({
        ...validSubmission,
        applicant: { ...validSubmission.applicant, mobile: "09 555 0101" },
      }).success,
    ).toBe(true);
    expect(
      submissionPayloadSchema.safeParse({
        ...validSubmission,
        applicant: { ...validSubmission.applicant, mobile: "(09) 555 0101" },
      }).success,
    ).toBe(true);
  });

  it.each([
    ["overseas phone", { applicant: { ...validSubmission.applicant, mobile: "+61 2 5550 1010" } }],
    ["letters in phone", { applicant: { ...validSubmission.applicant, mobile: "021 CALL NOW" } }],
    ["malformed phone punctuation", { applicant: { ...validSubmission.applicant, mobile: "021()---5550101" } }],
    ["unbalanced phone punctuation", { applicant: { ...validSubmission.applicant, mobile: "021))))5550101" } }],
    ["malformed email", { applicant: { ...validSubmission.applicant, email: "not-an-email" } }],
    ["markup in name", { applicant: { ...validSubmission.applicant, name: "<script>Aroha</script>" } }],
    ["markup in address", { project: { ...validSubmission.project, address: "<img src=x>" } }],
    ["invalid consent reference", { project: { ...validSubmission.project, buildingConsentNumber: "BC-123<script>" } }],
    ["invented system", { design: { ...validSubmission.design, system: "custom-system" } }],
    ["invented location type", { site: { ...validSubmission.site, locations: [{ types: ["server-room"], environment: "external", other: "" }] } }],
  ])("rejects %s", (_label, override) => {
    expect(
      submissionPayloadSchema.safeParse({
        ...validSubmission,
        ...override,
      }).success,
    ).toBe(false);
  });

  it("rejects removed city and postal-code properties instead of retaining hidden inputs", () => {
    expect(
      submissionPayloadSchema.safeParse({
        ...validSubmission,
        project: { ...validSubmission.project, city: "Auckland", postalCode: "1010" },
      }).success,
    ).toBe(false);
  });

  it("applies the same character and enum restrictions to partial drafts", () => {
    expect(draftPayloadSchema.safeParse({ applicant: { name: "Aroha Ngāta" } }).success).toBe(true);
    expect(draftPayloadSchema.safeParse({ applicant: { name: "<script>" } }).success).toBe(false);
    expect(draftPayloadSchema.safeParse({ design: { system: "invented" } }).success).toBe(false);
    expect(
      draftPayloadSchema.safeParse({ site: { locations: [{ types: ["invented"] }] } }).success,
    ).toBe(false);
  });

  it("allows normal paragraphs but rejects control and bidirectional override characters", () => {
    expect(informationResponseSchema.safeParse("First paragraph.\n\nSecond paragraph.").success).toBe(true);
    expect(informationResponseSchema.safeParse("Hidden\u0000control").success).toBe(false);
    expect(informationResponseSchema.safeParse("Misleading\u202evalue").success).toBe(false);
  });
});
