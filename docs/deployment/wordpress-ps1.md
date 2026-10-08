# WordPress-native `/ps1` deployment

The public page is `https://royalglass.co.nz/ps1/`. The current implementation runs directly inside WordPress through the `[royal_glass_ps1]` shortcode. It does not require Vercel, Neon, R2, Resend, the legacy iframe wrapper, or `RG_PS1_APP_URL`.

This is an operator runbook, not deployment authorization. Commit, push, cPanel deployment, WordPress activation, configuration, live submission, and page publication are separate approval gates.

## 1. Identify the exact candidate

1. Confirm the approved Git branch and commit. `dev` is the active development branch; do not assume it is approved for production.
2. Confirm the version agrees in:
   - `wordpress-native/royal-glass-ps1-native/package.json`
   - the plugin header in `royal-glass-ps1-native.php`
   - `RG_PS1_NATIVE_VERSION` in the same PHP file
3. Run from `wordpress-native/royal-glass-ps1-native`:

   ```powershell
   npm test
   npm run check:js
   npm run package
   ```

4. Record the test summary, generated ZIP path, and SHA-256. Run the WordPress Playground integration/browser/latency checks in the approved environment and record the runner and versions.
5. Inspect `wordpress-native/artifacts/royal-glass-ps1-native.zip`. Its top-level directory must be `royal-glass-ps1-native/`, containing the entry PHP file, `README.md`, `assets/`, and `includes/`.
6. Review the current security sign-off. The tracked review is a **FAIL**, not public-release approval; any decision to proceed under accepted residual risk must be explicit and must not be represented as a security PASS.

## 2. Back up and prepare WordPress

Before modifying the site:

1. Back up the WordPress database, `wp-config.php`, and the currently installed `royal-glass-ps1-native` plugin directory.
2. Record the active plugin version and whether `/ps1/` is draft, private, or published.
3. Verify a rollback operator can restore both the prior plugin directory and database backup.
4. Prepare a writable private upload directory outside `public_html`. Do not use the WordPress media library or any web-accessible directory.
5. Confirm the site has working SMTP for `wp_mail()` and a Bluehost/cPanel system cron that requests `wp-cron.php` regularly.

## 3. Configure `wp-config.php`

Add the following before WordPress's `stop editing` comment. Use environment-specific values and never commit them.

```php
define( 'RG_PS1_PUBLIC_URL', 'https://royalglass.co.nz/ps1/' );
define( 'RG_PS1_PRIVATE_UPLOAD_DIR', '/home/ACCOUNT/rg-ps1-private' );
define( 'RG_PS1_RATE_LIMIT_SECRET', 'at-least-32-random-characters' );
define( 'RG_PS1_TURNSTILE_SITE_KEY', 'public-site-key' );
define( 'RG_PS1_TURNSTILE_SECRET_KEY', 'private-secret-key' );
define( 'RG_PS1_GOOGLE_MAPS_API_KEY', 'browser-key-restricted-to-approved-referrers' );
define( 'RG_PS1_SERVICEM8_EMAIL', 'existing-staff-review-inbox@royalglass.co.nz' );
define( 'RG_PS1_SUPPORT_EMAIL', 'support@royalglass.co.nz' );
```

Configuration rules:

- `RG_PS1_PRIVATE_UPLOAD_DIR` must be outside the public web root and writable by the PHP user. Uploads remain unavailable without it.
- Generate `RG_PS1_RATE_LIMIT_SECRET` independently; use at least 32 random characters.
- Restrict the Turnstile widget to the exact staging/production hostnames.
- Restrict the Google browser key to Maps JavaScript API and Places API (New), plus exact approved referrers such as `https://royalglass.co.nz/*`.
- `RG_PS1_SERVICEM8_EMAIL` is the existing staff-review destination. The name is legacy; submission does not create a ServiceM8 job.
- `RG_PS1_SUPPORT_EMAIL` receives staff copies and is used as applicant Reply-To. If absent, code falls back to the WordPress administrator email, but production should set it explicitly.

## 4. Deploy the plugin

There are two supported source-delivery paths. Use one for the approved candidate and record which path was used.

### cPanel Git deployment

The repository's `.cpanel.yml` copies these source paths into `/home2/royalgl8/public_html/wp-content/plugins/royal-glass-ps1-native`:

- `assets/`
- `includes/`
- `royal-glass-ps1-native.php`

The cPanel task does not copy `README.md`, tests, packaging scripts, or secrets. It also does not activate the plugin, run live acceptance, or publish the page. Confirm the cPanel checkout commit before triggering deployment and inspect the deployed file version afterward.

### Manual ZIP installation

Upload `wordpress-native/artifacts/royal-glass-ps1-native.zip` through **WordPress Admin → Plugins → Add New → Upload Plugin**. When updating an existing installation, preserve the backup and verify WordPress replaced the intended plugin directory.

On first activation, or when schema version changes, the plugin uses `dbDelta()` to create/update only its dedicated prefixed tables. Activation also schedules daily cleanup and hourly mail-outbox events. It does not import the earlier Next.js/Neon data, create a ServiceM8 Job Card, create the `/ps1` page, or publish content.

Deactivation unschedules the plugin hooks but deliberately leaves tables and private files in place. Do not manually delete those during rollback without a separately approved data-retention decision.

## 5. Prepare the WordPress page

1. Create or reuse a page titled **PS1 Application** with slug `ps1`.
2. Use the site's full-width page template.
3. Put only `[royal_glass_ps1]` in the application content area.
4. Keep the page draft/private until all staging or live acceptance checks pass.
5. Exclude `/ps1/` from session replay and any analytics configuration that captures form content, query strings, URL fragments, or personal data.
6. Clear the WordPress/page cache and Cloudflare cache for `/ps1/` after deployment.

## 6. Production-shaped acceptance

Use synthetic applicant data and an approved test mailbox. Do not send personal information to a new provider or run a real public submission without explicit authorization.

Verify on desktop and mobile, including keyboard-only operation:

1. The page shows one Royal Glass header/footer and one native application; there is no iframe or nested scrollbar.
2. The plugin reports the expected version and no configuration warning appears for an administrator.
3. Turnstile works; failure and temporary-unavailable states fail closed without losing entered data.
4. New Zealand Google Places suggestions work and manual address entry remains usable when Google is blocked or unavailable.
5. Starting a draft returns a private resume credential; refresh and the resume-email link restore only the correct unexpired draft; the browser removes the token fragment after capture.
6. Draft, resume-email, and upload rate limits behave as expected without exposing raw IP addresses or bearer tokens.
7. PDF, JPEG/JPG, PNG, and DWG acceptance works within the five-file, 10 MiB-per-file, and 25 MiB-combined limits.
8. Unsupported extension, mismatched MIME/signature, oversize, excess-count, and deletion-failure paths are rejected safely.
9. Uploaded files are stored outside the public web root and cannot be fetched by a public URL.
10. Submission produces one locked application reference and returns promptly without waiting for SMTP delivery.
11. The queued staff email reaches the configured review and support recipients, uses the applicant as Reply-To, and contains safe original filenames for optional attachments.
12. The applicant confirmation reaches only the applicant, has no attachment, and uses support as Reply-To.
13. Both messages display `PS1 Application` as the sender name while the site's authenticated SMTP sender address remains unchanged.
14. A failed mail attempt is retained and retried by the outbox without creating a duplicate submission.
15. The admin-only outcome route rejects anonymous/non-admin callers. Accepted requires a ServiceM8 reference; unaccepted also requires confirmation that the applicant was phoned.
16. Deterministic lifecycle checks prove 24-hour draft expiry, 14-day review escalation, 30-day pending-intake expiry, and seven-day post-outcome deletion.
17. System cron is observable and cleanup/outbox events run on schedule. Record any missing alerting as an open operational risk.
18. Staff open test attachments only on a managed Windows device with Microsoft Defender, following the accepted operating procedure.

The strict security matrix and evidence format live under `security/ps1-data-retention-and-upload-safety/`. Do not convert partial or local-only checks into a strict E2E PASS.

## 7. Publish and observe

Publish `/ps1/` only after the candidate, configuration, acceptance evidence, residual-risk decision, and publication action are explicitly approved.

Immediately after publication:

1. Recheck the page in a logged-out private window without submitting real customer data.
2. Confirm the deployed plugin version, shortcode rendering, Turnstile, address fallback, SMTP/outbox cron, cleanup cron, and private-directory permissions.
3. Monitor the staff review inbox, outbox failures, scheduled-event health, storage growth, and 14-day escalation behaviour.
4. Keep logs free of applicant payloads, upload contents, resume tokens, and secrets.
5. Record the deployed commit, plugin version, artifact hash or cPanel deployment revision, activation time, operator, acceptance evidence, and rollback point.

## 8. Rollback

If the application fails acceptance or monitoring:

1. Unpublish or return `/ps1/` to draft so new applications cannot start.
2. Restore the backed-up plugin directory or approved prior ZIP.
3. Restore the database only if schema/data recovery is required and explicitly approved; a database restore can overwrite unrelated WordPress activity.
4. Preserve queued mail and intake/uploads until the operational owner decides how to recover them. Do not delete personal data ad hoc.
5. Verify scheduled hooks match the restored version and clear relevant caches.
6. Record the incident, affected candidate, retained data, and follow-up action.

Git state, local tests, a built ZIP, a cPanel copy, plugin activation, configuration, acceptance, publication, and a successful customer-visible journey are separate evidence points. Report each one accurately.
