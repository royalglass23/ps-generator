# Royal Glass PS1 Application (WordPress Native)

This is a separate WordPress-native implementation of the Royal Glass PS1 application. It does not modify or load the repository's original `web/` application or iframe wrapper.

## What it provides

- `[royal_glass_ps1]` renders the application directly in the WordPress page—there is no iframe.
- Anonymous REST routes under `/wp-json/royal-glass-ps1/v1/` create, save, restore, upload, and submit drafts.
- The job address uses Google Places suggestions restricted to New Zealand when a WordPress-managed browser key is configured. Manual address entry remains available and becomes the automatic fallback if Google cannot load.
- Dedicated WordPress tables store applications, private-upload metadata, rate-limit buckets, status history, and a durable email outbox.
- Resume tokens are generated from 32 random bytes; only SHA-256 hashes are stored. Resume links put the bearer token in the URL fragment, and the browser removes that fragment after capturing it.
- Submission locking and email queueing occur in one database transaction.
- Files are validated by extension, detected MIME type, size, and file signature before they are accepted.
- WordPress scheduled events retry queued email and remove expired drafts and their private files.

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
define( 'RG_PS1_SERVICEM8_EMAIL', 'the-approved-servicem8-inbox@example.com' );
define( 'RG_PS1_SUPPORT_EMAIL', 'support@royalglass.co.nz' );
```

`RG_PS1_PRIVATE_UPLOAD_DIR` should point outside the public web root and must be writable by PHP. Uploads remain disabled until it is configured. The plugin also writes `.htaccess` and `index.php` denial files as defence in depth, but those files are not a substitute for storage outside the web root.

`RG_PS1_GOOGLE_MAPS_API_KEY` is a browser key, so it is intentionally sent to the page. Restrict it in Google Cloud to the Maps JavaScript API and Places API (New), and to the production referrer `https://royalglass.co.nz/*` (plus any explicit staging origin used for testing).

The site must have reliable SMTP delivery configured for `wp_mail()`. The plugin queues both the ServiceM8/support message and applicant confirmation before it locks the application, then retries failed messages through the outbox. PS1 emails set the visible sender to `PS1 Generator <support@royalglass.co.nz>` at the final PHPMailer boundary so a site-wide SMTP display name such as `Royal Glass` does not replace it; the SMTP provider may still show its authenticated envelope address as “on behalf of,” which is expected.

## Installation and rollout

1. Back up the WordPress database and `wp-config.php`.
2. Configure the constants above with development or staging values.
3. Run `npm test`, `npm run check:js`, and the WordPress Playground integration check.
4. Run `npm run package` to create `../artifacts/royal-glass-ps1-native.zip`.
5. Install and activate the ZIP on staging first. Activation creates only the dedicated `wp_rg_ps1_*` tables and two scheduled hooks.
6. Create or reuse a draft `/ps1` page containing only `[royal_glass_ps1]`.
7. Validate draft creation, refresh/resume, uploads, removal, submission, both emails, expiry, rate limiting, and mobile layout.
8. Configure a Bluehost system cron to request `wp-cron.php` regularly. WordPress's traffic-driven cron alone can delay retry and retention jobs on a quiet site.
9. Publish only after a production-shaped staging run passes and publication is explicitly approved.

Activation does not migrate data from Neon, publish a page, alter the original iframe wrapper, or delete existing content. Deactivation unschedules this plugin's jobs but retains its tables and private files.

## Current boundary

This implementation covers the current public applicant journey. Staff authentication, staff-created More Information Requests, official status changes, archiving, and ServiceM8 job conversion remain intentionally unexposed, matching the original application's current public boundary.
