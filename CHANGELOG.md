# Changelog

This file records deployable changes to the current WordPress-native PS1 Application. Dates use New Zealand local dates. The repository has no Git tags; commit IDs are included so a developer can reconstruct each release candidate.

## Unreleased

- Replaced the placeholder root README with a current architecture and developer handoff.
- Added a documentation index and corrected the deployment runbook from the superseded Vercel/iframe path to the WordPress-native path.
- Updated product documentation to identify the native plugin as the current implementation and the Next.js application as reference code.

Documentation-only changes do not alter plugin version `0.2.3` or the packaged ZIP.

## 0.2.3 — 2026-10-08

- Changed submission delivery to queue both messages and return the receipt before mail delivery.
- Added non-blocking immediate WordPress cron dispatch while retaining the hourly outbox retry.
- Added submission-latency integration fixtures.
- Commit: `6088439`

## 0.2.2 — 2026-10-08

- Set the visible PS1 email sender name to `PS1 Application` while preserving the SMTP-authenticated sender address and per-message Reply-To.
- Preserved each applicant upload's safe original filename when preparing staff email attachments.
- Commits: `6daa829`, `69cb115`

## 0.2.1 — 2026-10-08

- Reused `RG_PS1_SERVICEM8_EMAIL` as the staff review destination instead of adding another inbox setting.
- Updated retention/upload security evidence and rebuilt the plugin artifact.
- Commit: `de3cc18`

## 0.2.0 — 2026-10-08

- Added the accepted ServiceM8 ownership and structural-upload-validation architecture decisions.
- Added private optional uploads with extension, detected MIME, size, and signature validation.
- Added dedicated application, upload, outbox, rate-limit, and status-history persistence.
- Added staff outcome recording and the 7/14/30-day intake lifecycle.
- Added durable mail queueing, review escalation, cleanup, integration fixtures, and Secure SDLC evidence.
- Commit: `b0422b3`

## 0.1.10 — 2026-10-07

- Scoped the mail-sender override to PS1 messages so the site's authenticated SMTP envelope remains unchanged.
- Commit: `5a21198`

## 0.1.9 — 2026-10-07

- Removed the tablet-width hero spacing gap.
- Commit: `5e6e69e`

## 0.1.8 — 2026-10-07

- Aligned native-plugin spacing and typography with the Royal Glass reference design.
- Commit: `64b3f19`

## 0.1.7 — 2026-10-07

- Refined the full-width PS1 hero treatment.
- Commit: `08c8208`

## 0.1.6 — 2026-10-07

- Restored the branded applicant confirmation email and rebuilt the installable plugin package.
- Commits: `190237b`, `ed30f83`

## 0.1.5 — 2026-10-07

- Added PS1-specific email sender handling.
- Fixed the browser flow so submission continues after the final security check.
- Commits: `a6d5e6e`, `014ff3e`

## 0.1.4 — 2026-10-07

- Improved upload progress and updated controls for the WordPress page context.
- Commits: `65228bd`, `e3e3b97`, `16808b6`

## 0.1.3 — 2026-10-07

- Refreshed the selected system image when the applicant changes system selection.
- Commit: `b7e1c2b`

## 0.1.2 — 2026-10-07

- Polished the native WordPress application presentation and interaction details.
- Commit: `9363639`

## 0.1.0 — 2026-10-07

- Introduced the direct WordPress implementation with shortcode rendering, REST-backed drafts, and packaged frontend assets.
- Added cPanel deployment configuration in the following commit.
- Commits: `f174532`, `1aa7de5`

## Earlier repository history — 2026-09-30 to 2026-10-06

- Built the static PS1 journey and supporting discovery, product, design, and research material.
- Implemented the Next.js/Neon/R2/Resend backend and applicant UI in `web/`.
- Added the iframe-based WordPress wrapper in `wordpress-plugin/`.
- These implementations remain reference material; they are not the current native-plugin deployment path.
