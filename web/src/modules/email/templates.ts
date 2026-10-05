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

const royalGlassWebsite = "https://www.royalglass.co.nz/";
const royalGlassLogo =
  "https://royalglass.co.nz/wp-content/uploads/2024/01/Royal-Glass-Logo-White-150x72.png";
const royalGlassHero =
  "https://royalglass.co.nz/wp-content/uploads/2026/01/Auckland-Remuera-1-scaled.jpg";
const royalGlassAddress = "13E Paul Matthews Road, Rosedale, Auckland 0632";
const royalGlassPhone = "0800 769 254";
const royalGlassSocials = {
  facebook: "https://www.facebook.com/royalglassnz",
  instagram: "https://www.instagram.com/royalglassanz/",
  linkedin: "https://www.linkedin.com/company/royalglassnz",
  youtube: "https://www.youtube.com/@RoyalGlassNZ/",
};

function applicantSummaryHtml(summaryText: string): string {
  const rows = summaryText
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      const label = separator >= 0 ? line.slice(0, separator) : "Detail";
      const value = separator >= 0 ? line.slice(separator + 1).trim() : line;
      return `<tr><th scope="row" style="width:36%;padding:11px 14px;border-bottom:1px solid #dfe4e5;color:#687376;font-size:12px;font-weight:600;line-height:1.45;text-align:left;vertical-align:top">${escapeHtml(label)}</th><td style="padding:11px 14px;border-bottom:1px solid #dfe4e5;color:#3d3d3d;font-size:14px;line-height:1.45;vertical-align:top">${escapeHtml(value)}</td></tr>`;
    })
    .join("");

  return `<table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dfe4e5;border-radius:4px;border-collapse:separate;border-spacing:0;overflow:hidden;background:#ffffff">${rows}</table>`;
}

function applicantEmailShell(
  preheader: string,
  heading: string,
  content: string,
  supportEmail: string,
): string {
  const safeSupportEmail = escapeHtml(supportEmail);
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>Royal Glass</title></head><body style="margin:0;padding:0;background:#fafafb;color:#3d3d3d;font-family:'Kumbh Sans',Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#fafafb"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dfe4e5;border-radius:4px;overflow:hidden"><tr><td background="${royalGlassHero}" bgcolor="#3d3d3d" style="padding:26px 32px 34px;background-color:#3d3d3d;background-image:linear-gradient(rgba(28,39,40,.72),rgba(28,39,40,.72)),url('${royalGlassHero}');background-position:center;background-size:cover"><img src="${royalGlassLogo}" width="150" alt="Royal Glass logo" style="display:block;width:150px;max-width:100%;height:auto;margin:0 0 38px;border:0"><p style="margin:0 0 8px;color:#b2dcdf;font-size:12px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase">PS1 application</p><h1 style="max-width:520px;margin:0;color:#ffffff;font-size:32px;font-weight:600;letter-spacing:-.5px;line-height:1.18">${heading}</h1></td></tr><tr><td style="padding:34px 32px 30px">${content}</td></tr><tr><td style="padding:28px 32px;background:#3d3d3d;color:#ffffff;font-size:12px;line-height:1.65"><p style="margin:0 0 5px;color:#ffffff;font-size:14px;font-weight:700">Royal Glass</p><p style="margin:0 0 2px"><a href="https://royalglass.co.nz/contact-us/" style="color:#dfe4e5;text-decoration:none">${royalGlassAddress}</a></p><p style="margin:0 0 18px"><a href="tel:+64800769254" style="color:#dfe4e5;text-decoration:none">${royalGlassPhone}</a><span style="color:#78b3b7"> &nbsp;&middot;&nbsp; </span><a href="mailto:${safeSupportEmail}" style="color:#dfe4e5;text-decoration:none">${safeSupportEmail}</a></p><p style="margin:0 0 9px;color:#b2dcdf;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">Follow Royal Glass</p><p style="margin:0 0 20px"><a href="${royalGlassSocials.facebook}" style="color:#ffffff;font-weight:600;text-decoration:none">Facebook</a><span style="color:#78b3b7"> &nbsp;&middot;&nbsp; </span><a href="${royalGlassSocials.instagram}" style="color:#ffffff;font-weight:600;text-decoration:none">Instagram</a><span style="color:#78b3b7"> &nbsp;&middot;&nbsp; </span><a href="${royalGlassSocials.linkedin}" style="color:#ffffff;font-weight:600;text-decoration:none">LinkedIn</a><span style="color:#78b3b7"> &nbsp;&middot;&nbsp; </span><a href="${royalGlassSocials.youtube}" style="color:#ffffff;font-weight:600;text-decoration:none">YouTube</a></p><p style="margin:0"><a href="${royalGlassWebsite}" style="display:inline-block;padding:10px 16px;border-radius:4px;background:#78b3b7;color:#ffffff;font-weight:700;text-decoration:none">See Royal Glass projects and services &rarr;</a></p></td></tr></table></td></tr></table></body></html>`;
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
  const supportEmail = escapeHtml(input.supportEmail);
  const applicantHtml = applicantEmailShell(
    `Royal Glass has received your PS1 application for ${input.address}.`,
    "We&#039;ve received your application",
    `<p style="margin:0 0 14px;color:#3d3d3d;font-size:16px;line-height:1.65">Hi ${applicantName}, thank you for submitting your PS1 application to Royal Glass.</p><p style="margin:0 0 24px;color:#3d3d3d;font-size:16px;line-height:1.65">We have received the details for <strong>${address}</strong>.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 30px;border-collapse:separate;border-spacing:0;background:#edf7f7;border-left:4px solid #78b3b7"><tr><td style="padding:17px 18px"><p style="margin:0 0 4px;color:#1a848b;font-size:13px;font-weight:700">Application received</p><p style="margin:0;color:#3d3d3d;font-size:14px;line-height:1.55">Our team will now review your details and supporting documents.</p></td></tr></table><h2 style="margin:0 0 14px;color:#3d3d3d;font-size:21px;font-weight:600;line-height:1.3">Your application summary</h2>${applicantSummaryHtml(input.summaryText)}<h2 style="margin:32px 0 16px;color:#3d3d3d;font-size:21px;font-weight:600;line-height:1.3">What happens next</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="width:34px;padding:0 10px 17px 0;color:#1a848b;font-size:12px;font-weight:700;vertical-align:top">01</td><td style="padding:0 0 17px;color:#3d3d3d;font-size:14px;line-height:1.55"><strong style="display:block">We review the application</strong>We check the information and supporting documents you provided.</td></tr><tr><td style="width:34px;padding:0 10px 17px 0;color:#1a848b;font-size:12px;font-weight:700;vertical-align:top">02</td><td style="padding:0 0 17px;color:#3d3d3d;font-size:14px;line-height:1.55"><strong style="display:block">We contact you if needed</strong>If anything is missing or needs clarification, our team will get in touch.</td></tr><tr><td style="width:34px;padding:0 10px 0 0;color:#1a848b;font-size:12px;font-weight:700;vertical-align:top">03</td><td style="padding:0;color:#3d3d3d;font-size:14px;line-height:1.55"><strong style="display:block">We confirm the next step</strong>We will advise you once the initial review is complete.</td></tr></table><p style="margin:26px 0;padding:14px 16px;background:#fafafb;border:1px solid #dfe4e5;color:#5c6668;font-size:13px;line-height:1.55">Submitting an application does not automatically confirm that a PS1 will be issued. Royal Glass will review the project first.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse"><tr><td style="padding:15px 17px;border-radius:4px;background:#1a848b;color:#ffffff"><span style="display:block;margin-bottom:3px;color:#b2dcdf;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">Application reference</span><strong style="font-size:17px;letter-spacing:.3px">${reference}</strong></td></tr></table><p style="margin:0;color:#3d3d3d;font-size:14px;line-height:1.65">Questions? Reply to this email or contact us at <a href="mailto:${supportEmail}" style="color:#1a848b;font-weight:700;text-decoration:underline">${supportEmail}</a>.</p><p style="margin:22px 0 0;color:#3d3d3d;font-size:14px;line-height:1.55">Kind regards,<br><strong>Royal Glass</strong></p>`,
    input.supportEmail,
  );

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
      html: applicantHtml,
    },
  ];
}
