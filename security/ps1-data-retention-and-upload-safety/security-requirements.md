# Security requirements — PS1 data retention and upload safety

- Mode: retrofit
- Base commit: `5a21198a5c67cef1c11f002c11b2a3a06f4c9ede`
- Target: WordPress/PHP 8.1 plugin; ServiceM8 is the authoritative business record
- Accepted decision: optional structurally valid uploads are emailed directly to staff without server-side malware scanning

## Actors and assets

- Anonymous applicants and draft-token holders are untrusted.
- Royal Glass staff review applications; only `manage_options` users record outcomes.
- WordPress stores temporary Intake Copies and sends staff/applicant email.
- Managed staff Windows devices are expected to run Microsoft Defender, but the plugin cannot attest to endpoint state or scan verdicts.
- Protected assets include contact details, project data, uploads, bearer credentials, staff decisions, and ServiceM8 references.

## Acceptance criteria

1. Uploads are optional and limited by extension, detected MIME, signature, per-file size, total size, count, and rate limits.
2. Files remain outside the public web root with random stored names and no download route.
3. Structurally valid uploads attach to staff review mail; applicant confirmation has no attachments.
4. Submission neither emails ServiceM8 nor creates a Job Card.
5. Only administrators may record outcomes; an unaccepted outcome requires phone-contact confirmation.
6. Confirmed outcomes retain the WordPress Intake Copy for seven days; unresolved reviews escalate after 14 days and expire after 30 days.
7. Cleanup and mail jobs are schedulable and failures must be operationally detectable without applicant content in logs.
8. Release evidence must exercise the exact package on isolated non-production WordPress with synthetic mail, deterministic roles/time, managed Defender endpoint behavior, and zero retries.

## Explicitly accepted residual risk

Structural validation is not malware detection. A malicious PDF, image, or DWG that satisfies structural checks can reach the staff mailbox. Mailbox and downloaded copies also outlive WordPress cleanup. This acceptance allows implementation but does not turn the Secure SDLC release gate into PASS.

## Abuse and failure cases

- Spoofed/polyglot/malformed content, malware, path traversal, upload exhaustion, and repeated attempts.
- Direct storage requests, anonymous outcome changes, guessed IDs, replayed/cross-draft credentials.
- Missing Defender protection, mail-provider filtering differences, cron failure, partial deletion, mailbox retention, and backups.
