# ADR-0002: Structurally validate optional uploads and email them to staff

## Status

Accepted with explicit security risk acceptance.

## Decision

Applicant uploads are optional. WordPress accepts only allowlisted PDF, JPG, PNG, and DWG files that pass size, detected-MIME, and signature checks, stores them outside the public web root, and attaches them directly to the staff review email. The applicant confirmation email never contains attachments. The plugin does not send files to ServiceM8 and does not create a Job Card automatically.

Royal Glass accepts that these structural checks do not prove a file is free of malware. There is no server-side ClamAV or third-party scanning subscription. Staff must open attachments only on Royal Glass-managed Windows devices protected by Microsoft Defender. Email-provider and mailbox retention are outside the WordPress deletion lifecycle and remain an accepted operational/privacy risk.

## Consequences

- Optional uploads remain usable on shared hosting without a new subscription.
- Private transient storage prevents direct public download while email delivery remains immediate.
- Malicious content inside an otherwise structurally valid file can reach the staff mailbox, so this design cannot receive a Secure SDLC PASS for public upload safety.
- WordPress still deletes Intake Copies after the 7/14/30-day lifecycle, but it cannot delete copies retained by mail systems or downloaded to staff devices.
