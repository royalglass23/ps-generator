# Royal Glass PS1 Application (WordPress Native)

This is a separate WordPress-native implementation of the Royal Glass PS1 application. It does not modify or load the repository's original `web/` application or iframe wrapper.

## What it provides

- `[royal_glass_ps1]` renders the application directly in the WordPress page—there is no iframe.
- Anonymous REST routes under `/wp-json/royal-glass-ps1/v1/` create, save, restore, upload, and submit drafts.
- The job address uses Google Places suggestions restricted to New Zealand when a WordPress-managed browser key is configured. Manual address entry remains available and becomes the automatic fallback if Google cannot load.
- Dedicated WordPress tables store applications, private-upload metadata, rate-limit buckets, status history, and a durable email outbox.
- Resume tokens are generated from 32 random bytes; only SHA-256 hashes are stored. Resume links put the bearer token in the URL fragment, and the browser removes that fragment after capturing it.
- Submission locking and email queueing occur in one database transaction.
- Optional files are held outside the public web root and validated by extension, detected MIME type, size, and signature. Structurally valid files are attached directly to the staff review email; the applicant confirmation has no attachments.
- WordPress scheduled events retry queued email, escalate unresolved reviews after 14 days, remove unresolved intake after 30 days, and remove reviewed intake seven days after staff confirms the ServiceM8 outcome.

The visual journey, wording, validation rules, system catalogue, and approved image assets were adapted from the existing Next.js implementation. The PHP backend is new because WordPress uses PHP and MySQL rather than Next.js and PostgreSQL.

## Required configuration

Add these values to `wp-config.php` before the `stop editing` comment. Do not commit real values to this repository.

```php
define( 'RG_PS1_PUBLIC_URL', 'https://royalglass.co.nz/ps1/' );
define( 'RG_PS1_PRIVATE_UPLOAD_DIR', '/home/ACCOUNT/rg-ps1-private' );
define( 'RG_PS1_RATE_LIMIT_SECRET', 'at-least-32-random-characters' );
define( 'RG_PS1_TURNSTILE_SITE_KEY', 'public-site-key' );
define( 'RG_PS1_TURNSTILE_SECRET_KEY', 'private-secret-key' );
define( 'RG_PS1_GOOGLE_MAPS_API_KEY', 'browser-key-restricted-to-royalglass.co.nz' );
define( 'RG_PS1_SERVICEM8_EMAIL', 'existing-staff-review-inbox@royalglass.co.nz' );
define( 'RG_PS1_SUPPORT_EMAIL', 'support@royalglass.co.nz' );
```

`RG_PS1_PRIVATE_UPLOAD_DIR` should point outside the public web root and must be writable by PHP. Uploads remain disabled until it is configured. The plugin also writes `.htaccess` and `index.php` denial files as defence in depth, but those files are not a substitute for storage outside the web root.

The plugin does not perform malware scanning. Staff review attachments on Royal Glass-managed Windows devices protected by Microsoft Defender. This is an explicitly accepted residual risk: extension, MIME, size, and signature checks reject malformed or unsupported input, but they do not establish that a file is free of malware. Do not open attachments on unmanaged devices, and do not configure a third-party upload-scanning API without a separate privacy and processor review.

`RG_PS1_GOOGLE_MAPS_API_KEY` is a browser key, so it is intentionally sent to the page. Restrict it in Google Cloud to the Maps JavaScript API and Places API (New), and to the production referrer `https://royalglass.co.nz/*` (plus any explicit staging origin used for testing).

The site must have reliable SMTP delivery configured for `wp_mail()`. The existing `RG_PS1_SERVICEM8_EMAIL` setting is reused as the staff-review destination, so no new email constant is required. The plugin queues that staff-review message with any optional uploads attached and a separate attachment-free applicant confirmation before it locks the application, then retries failed messages through the outbox. Despite the legacy constant name, submission does not create a ServiceM8 Job Card. Only PS1 emails temporarily set the visible sender name to `PS1 Application`; the sender address remains the mailbox authenticated by the site's SMTP configuration, and the message-specific Reply-To address remains unchanged.

After staff create the accepted Job Card or record the unaccepted non-job outcome in ServiceM8, an authenticated WordPress administrator records that outcome through `POST /wp-json/royal-glass-ps1/v1/applications/{id}/outcome` using `outcome`, `serviceM8Reference`, and `applicantContacted`. Accepted outcomes require the ServiceM8 reference; unaccepted outcomes also require confirmation that the applicant was called. This starts the seven-day WordPress recovery window.

## Installation and rollout

1. Back up the WordPress database and `wp-config.php`.
2. Configure the constants above with development or staging values.
3. Run `npm test`, `npm run check:js`, and the WordPress Playground integration check.
4. Run `npm run package` to create `../artifacts/royal-glass-ps1-native.zip`.
5. Install and activate the ZIP on staging first. Activation creates only the dedicated `wp_rg_ps1_*` tables and two scheduled hooks.
6. Create or reuse a draft `/ps1` page containing only `[royal_glass_ps1]`.
7. Validate draft creation, refresh/resume, supported and rejected uploads, removal, direct staff attachments, attachment-free applicant confirmation, staff outcome recording, 7/14/30-day retention transitions, rate limiting, Microsoft Defender handling on the staff device, and mobile layout.
8. Configure a Bluehost system cron to request `wp-cron.php` regularly. WordPress's traffic-driven cron alone can delay retry and retention jobs on a quiet site.
9. Publish only after a production-shaped staging run passes and publication is explicitly approved.

Activation does not migrate data from Neon, publish a page, alter the original iframe wrapper, or delete existing content. Deactivation unschedules this plugin's jobs but retains its tables and private files.

## Current boundary

This implementation covers the current public applicant journey. Staff authentication, staff-created More Information Requests, official status changes, archiving, and ServiceM8 job conversion remain intentionally unexposed, matching the original application's current public boundary.
