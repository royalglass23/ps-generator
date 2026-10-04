import { describe, expect, it } from "vitest";

import { buildDraftResumeEmail, buildSubmissionEmails } from "@/modules/email/templates";

describe("submission email templates", () => {
  it("builds an applicant-only draft resume email with a private link", () => {
    const resumeUrl = "https://ps1.example.test/application/draft-1#token=resume-secret";
    const message = buildDraftResumeEmail({
      applicantName: "Aroha Ngata",
      applicantEmail: "aroha@example.co.nz",
      resumeUrl,
      supportEmail: "support@royalglass.co.nz",
      applicantFromEmail: "Royal Glass <support@royalglass.co.nz>",
    });

    expect(message.kind).toBe("draft_resume");
    expect(message.to).toEqual(["aroha@example.co.nz"]);
    expect(message.text).toContain(resumeUrl);
    expect(message.html).toContain(`href="${resumeUrl}"`);
    expect(message.text).toContain("Keep this link private");
    expect(message.text).toContain("expires after 24 hours");
    expect(message.html).toContain("expires after 24 hours");
  });

  it("routes the internal summary to support and ServiceM8 using the agreed subject", () => {
    const messages = buildSubmissionEmails({
      reference: "PS1-2026-ABC12345",
      applicantName: "Jordan Applicant",
      applicantEmail: "jordan@example.test",
      address: "28 Example Street, Auckland 1010",
      summaryText: "Applicant: Jordan Applicant\nSystem: Not sure",
      supportEmail: "support@royalglass.co.nz",
      serviceM8Email: "de9f86@inbox.servicem8.com",
      internalFromEmail: "PS1 Generator <support@royalglass.co.nz>",
      applicantFromEmail: "Royal Glass <support@royalglass.co.nz>",
    });

    const internal = messages.find((message) => message.kind === "internal_submission");
    expect(internal?.to).toEqual([
      "support@royalglass.co.nz",
      "de9f86@inbox.servicem8.com",
    ]);
    expect(internal?.subject).toBe("PS1 Generator - 28 Example Street, Auckland 1010");
    expect(internal?.from).toBe("PS1 Generator <support@royalglass.co.nz>");
  });

  it("sends the applicant a friendly summary and honest next steps", () => {
    const messages = buildSubmissionEmails({
      reference: "PS1-2026-ABC12345",
      applicantName: "Jordan Applicant",
      applicantEmail: "jordan@example.test",
      address: "28 Example Street, Auckland 1010",
      summaryText: "Applicant: Jordan Applicant\nSystem: Not sure",
      supportEmail: "support@royalglass.co.nz",
      serviceM8Email: "de9f86@inbox.servicem8.com",
      internalFromEmail: "PS1 Generator <support@royalglass.co.nz>",
      applicantFromEmail: "Royal Glass <support@royalglass.co.nz>",
    });

    const applicant = messages.find((message) => message.kind === "applicant_confirmation");
    expect(applicant?.to).toEqual(["jordan@example.test"]);
    expect(applicant?.subject).toBe(
      "PS1 Application for 28 Example Street, Auckland 1010",
    );
    expect(applicant?.text).toContain("Hi Jordan Applicant");
    expect(applicant?.from).toBe("Royal Glass <support@royalglass.co.nz>");
    expect(applicant?.text).toContain("does not automatically confirm that a PS1 will be issued");
  });
});
