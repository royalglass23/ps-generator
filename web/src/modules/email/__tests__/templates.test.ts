import { describe, expect, it } from "vitest";

import { buildSubmissionEmails } from "@/modules/email/templates";

describe("submission email templates", () => {
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
