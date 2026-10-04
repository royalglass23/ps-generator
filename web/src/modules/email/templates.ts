import type { EmailMessage } from "./types";

interface SubmissionEmailInput {
  reference: string;
  applicantName: string;
  applicantEmail: string;
  address: string;
  summaryText: string;
  supportEmail: string;
  serviceM8Email: string;
  internalFromEmail: string;
  applicantFromEmail: string;
}

interface DraftResumeEmailInput {
  applicantName: string;
  applicantEmail: string;
  resumeUrl: string;
  supportEmail: string;
  applicantFromEmail: string;
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[
        character
      ] ?? character,
  );
}

function summaryHtml(summaryText: string): string {
  return `<pre style="font:inherit;white-space:pre-wrap">${escapeHtml(summaryText)}</pre>`;
}

export function buildDraftResumeEmail(input: DraftResumeEmailInput): EmailMessage {
  const text = [
    `Hi ${input.applicantName}`,
    "",
    "Your Royal Glass PS1 application has been saved.",
    "",
    "Use this secure link to continue your application:",
    input.resumeUrl,
    "",
    "This link expires after 24 hours.",
    "",
    "Keep this link private. Anyone with the link can access your saved application.",
    "",
    `If you have any questions, reply to this email or contact us at ${input.supportEmail}.`,
    "",
    "Kind regards,",
    "Royal Glass",
  ].join("\n");
  const resumeUrl = escapeHtml(input.resumeUrl);

  return {
    kind: "draft_resume",
    from: input.applicantFromEmail,
    to: [input.applicantEmail],
    replyTo: input.supportEmail,
    subject: "Continue your Royal Glass PS1 application",
    text,
    html: `<p>Hi ${escapeHtml(input.applicantName)}</p><p>Your Royal Glass PS1 application has been saved.</p><p><a href="${resumeUrl}">Continue your application</a></p><p>This link expires after 24 hours.</p><p>Keep this link private. Anyone with the link can access your saved application.</p><p>If you have any questions, reply to this email or contact us at ${escapeHtml(input.supportEmail)}.</p><p>Kind regards,<br>Royal Glass</p>`,
  };
}

export function buildSubmissionEmails(input: SubmissionEmailInput): EmailMessage[] {
  const internalText = [
    "A new PS1 application has been submitted through the Royal Glass PS1 Generator.",
    "",
    "Application summary",
    input.summaryText,
    "",
    `Application reference: ${input.reference}`,
    "",
    "Please review this application and determine whether it should be converted into a ServiceM8 job card.",
  ].join("\n");

  const applicantText = [
    `Hi ${input.applicantName}`,
    "",
    "Thank you for submitting your PS1 application to Royal Glass.",
    "",
    `We have received your application for ${input.address}. A summary of the information you provided is included below.`,
    "",
    "Application summary",
    input.summaryText,
    "",
    "What happens next",
    "Our team will review the information and supporting documents you provided. We will confirm whether we have enough information, contact you if anything further is needed, and advise you of the appropriate next step.",
    "",
    "Submitting this application does not automatically confirm that a PS1 will be issued. Royal Glass will review the project first.",
    "",
    `Application reference: ${input.reference}`,
    "",
    `If you have any questions, reply to this email or contact us at ${input.supportEmail}.`,
    "",
    "Kind regards,",
    "Royal Glass",
  ].join("\n");

  const applicantName = escapeHtml(input.applicantName);
  const address = escapeHtml(input.address);
  const reference = escapeHtml(input.reference);

  return [
    {
      kind: "internal_submission",
      from: input.internalFromEmail,
      to: [input.supportEmail, input.serviceM8Email],
      replyTo: input.applicantEmail,
      subject: `PS1 Generator - ${input.address}`,
      text: internalText,
      html: `<p>A new PS1 application has been submitted through the Royal Glass PS1 Generator.</p><h2>Application summary</h2>${summaryHtml(input.summaryText)}<p><strong>Application reference:</strong> ${reference}</p><p>Please review this application and determine whether it should be converted into a ServiceM8 job card.</p>`,
    },
    {
      kind: "applicant_confirmation",
      from: input.applicantFromEmail,
      to: [input.applicantEmail],
      replyTo: input.supportEmail,
      subject: `PS1 Application for ${input.address}`,
      text: applicantText,
      html: `<p>Hi ${applicantName}</p><p>Thank you for submitting your PS1 application to Royal Glass.</p><p>We have received your application for <strong>${address}</strong>.</p><h2>Application summary</h2>${summaryHtml(input.summaryText)}<h2>What happens next</h2><p>Our team will review the information and supporting documents you provided. We will confirm whether we have enough information, contact you if anything further is needed, and advise you of the appropriate next step.</p><p>Submitting this application does not automatically confirm that a PS1 will be issued. Royal Glass will review the project first.</p><p><strong>Application reference:</strong> ${reference}</p><p>If you have any questions, reply to this email or contact us at ${escapeHtml(input.supportEmail)}.</p><p>Kind regards,<br>Royal Glass</p>`,
    },
  ];
}
