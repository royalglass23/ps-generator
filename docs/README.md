# Developer handoff

Last reconciled with `dev` at `6088439` on 2026-10-09. Re-run `git status`, `git log -1`, and the validation commands before relying on this snapshot.

## What this system does

The public form collects a PS1 Application for human Royal Glass review. The customer can start a 24-hour draft, save and resume it through a bearer-token link, add optional supporting files, and submit. Submission locks the intake record, creates a `PS1-YYYY-XXXXXXXX` reference, queues a staff review email and an attachment-free applicant confirmation, and schedules mail delivery.

The form does not decide technical suitability, issue a PS1, approve commercial work, or create a ServiceM8 Job Card. Staff complete that work outside this public surface.

## Authoritative implementation

`wordpress-native/royal-glass-ps1-native/` is the current deployable implementation.

```text
WordPress page containing [royal_glass_ps1]
  -> assets/app.js renders the six-section browser journey
  -> /wp-json/royal-glass-ps1/v1/* REST routes
  -> RG_PS1_Service coordinates validation and state changes
  -> RG_PS1_Database stores temporary intake and durable outbox rows
  -> RG_PS1_Storage keeps optional files outside the public web root
  -> RG_PS1_Mailer sends through wp_mail() and the site's SMTP plugin
  -> staff review and ServiceM8 action happen outside this public UI
```

The earlier `web/` app and `wordpress-plugin/` iframe wrapper are superseded as a deployment architecture. They are still useful for behavioural history and comparison. Do not accidentally update only the Next.js copy when the requested change is for the live native candidate.

## Code map

| File | Responsibility |
| --- | --- |
| `royal-glass-ps1-native.php` | Plugin bootstrap, version, shortcode, assets, schedules, configuration notice. |
| `assets/app.js` | Applicant flow, API calls, resume-token handling, address lookup, uploads, submission UI. |
| `assets/domain.mjs` | Shared browser-domain rules and data used by tests. |
| `assets/app.css` | Scoped application styling and responsive layouts. |
| `includes/class-rg-ps1-rest-controller.php` | Public REST adapter, Turnstile verification, bearer extraction, admin-only outcome route. |
| `includes/class-rg-ps1-service.php` | Draft, upload, submit, outcome, retention, rate-limit, and transaction orchestration. |
| `includes/class-rg-ps1-validator.php` | Draft/submission payload allowlists and required-field validation. |
| `includes/class-rg-ps1-database.php` | Schema version 3, SQL persistence, row locking, transactions, outbox claims, cleanup queries. |
| `includes/class-rg-ps1-storage.php` | Private file storage, limits, MIME/signature checks, deletion. |
| `includes/class-rg-ps1-mailer.php` | Message construction, durable outbox dispatch, attachments, retries, sender-name scoping. |
| `tests/` | Node contracts plus WordPress Playground browser/integration/latency fixtures. |
| `scripts/package.ps1` | Stages deployable source, builds ZIP, prints SHA-256. |

## REST surface

All public draft routes require a bearer token after draft creation. Only the token hash is stored. The resume URL carries the token in the fragment so it is not sent in normal HTTP request logs; the browser captures and removes it.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/applications/drafts` | Public + Turnstile | Create a 24-hour draft and resume credential. |
| `GET` | `/applications/drafts/:id` | Draft bearer token | Restore an available draft. |
| `POST/PUT/PATCH` | `/applications/drafts/:id` | Draft bearer token | Validate/save and renew the 24-hour expiry. |
| `POST` | `/applications/drafts/:id/resume-link` | Draft bearer token | Queue a private resume email after name/email exist. |
| `POST` | `/applications/drafts/:id/uploads` | Draft bearer token | Validate and store one multipart upload. |
| `DELETE` | `/applications/drafts/:id/uploads/:uploadId` | Draft bearer token | Delete a stored upload and its metadata. |
| `POST` | `/applications/drafts/:id/submit` | Draft bearer token | Validate, lock, create reference, and queue messages transactionally. |
| `POST` | `/applications/:id/outcome` | WordPress `manage_options` | Record accepted/unaccepted ServiceM8 outcome and start seven-day recovery retention. |

The route paths above are relative to `/wp-json/royal-glass-ps1/v1`.

## Data and lifecycle

Activation or schema-version drift runs `dbDelta()` for five prefixed tables: applications, uploads, mail outbox, rate-limit buckets, and status history. Deactivation removes scheduled hooks but deliberately retains tables and private files.

Important transitions:

- `draft`: 24-hour sliding expiry; only a valid resume token can read or modify it.
- `submitted`: set at submission; applicant editing is locked while staff review is pending.
- `accepted` or `unaccepted`: recorded only by an authenticated WordPress administrator after the corresponding ServiceM8 record and required contact are confirmed.
- `expired_draft` or `expired_intake`: personal payload, resume credential, uploads, and application outbox rows are purged while the non-payload lifecycle row and separate status history remain.

Daily cleanup expires old drafts, escalates submitted applications after 14 days, purges still-pending intake at 30 days, purges accepted/unaccepted intake after its seven-day recovery window, retries due mail, and deletes expired limiter/outbox rows.

ServiceM8 is the durable business record. `RG_PS1_SERVICEM8_EMAIL` is currently a staff-review inbox despite its legacy name; receiving an email is not a successful ServiceM8 handoff.

## Configuration

Production values belong in `wp-config.php`, never Git:

| Constant | Required purpose |
| --- | --- |
| `RG_PS1_PUBLIC_URL` | Public `/ps1/` base for resume links. Falls back to `home_url('/ps1/')`. |
| `RG_PS1_PRIVATE_UPLOAD_DIR` | Writable private directory outside the public web root. Uploads remain disabled without it. |
| `RG_PS1_RATE_LIMIT_SECRET` | Independent random HMAC secret of at least 32 characters. |
| `RG_PS1_TURNSTILE_SITE_KEY` | Browser-visible Cloudflare Turnstile site key. |
| `RG_PS1_TURNSTILE_SECRET_KEY` | Server-side Turnstile verification secret. |
| `RG_PS1_GOOGLE_MAPS_API_KEY` | Browser key restricted to required Maps/Places APIs and approved referrers. |
| `RG_PS1_SERVICEM8_EMAIL` | Existing staff review destination. |
| `RG_PS1_SUPPORT_EMAIL` | Applicant Reply-To/support address; falls back to WordPress admin email. |

WordPress must have reliable SMTP for `wp_mail()`. Configure a real system cron to request `wp-cron.php`; traffic-driven cron alone is not a reliable operational guarantee on a quiet page.

## Upload and email boundary

- Allowed: PDF, JPEG/JPG, PNG, DWG.
- Limits: five files, 10 MiB per file, 25 MiB combined.
- Controls: allowlisted extension, detected MIME, byte count, and file signature; private random stored names; safe original name restored only in a temporary private mail workspace.
- Staff message: review inbox and support inbox, applicant email as Reply-To, uploads attached.
- Applicant message: applicant only, support Reply-To, no attachments.
- Delivery: submission commits application lock and both outbox rows together, then schedules immediate non-blocking cron. The hourly outbox schedule is the retry safety net; maximum attempts are controlled by `RG_PS1_Database::MAX_EMAIL_ATTEMPTS`.

The plugin has no malware scanner. A structurally valid malicious file can reach the staff mailbox. The accepted operating model relies on managed Windows devices with Microsoft Defender, but the tracked Secure SDLC sign-off remains **FAIL**. Never turn that business risk acceptance into a claim of security approval.

## Development and validation

From `wordpress-native/royal-glass-ps1-native`:

```powershell
npm test
npm run check:js
npm run package
```

After a behaviour change, also run the relevant WordPress Playground integration, browser, and submission-latency blueprints in an approved environment. The repo does not pin the Playground CLI, so record the exact runner command and versions in the verification evidence.

For a release candidate:

1. Confirm the expected branch and cleanly isolate the intended files.
2. Update the plugin version in `package.json`, the PHP plugin header, and `RG_PS1_NATIVE_VERSION`.
3. Add or update a Node contract and PHP/Playground coverage for observable behaviour.
4. Run the validation above and the applicable Playground checks.
5. Run `npm run package`; record the output path and SHA-256.
6. Inspect the ZIP and compare its deployable PHP/assets/includes files with the source tree.
7. Update `CHANGELOG.md` and any affected runbook/architecture document.
8. Keep commit, push, deployment, activation, configuration, live testing, and publication as separate approval gates.

## Deployment reality

`.cpanel.yml` copies only the native plugin entry file, `assets/`, and `includes/` to `/home2/royalgl8/public_html/wp-content/plugins/royal-glass-ps1-native`. The ZIP is an alternate manual installation artifact. Neither path configures `wp-config.php`, activates the plugin, creates or publishes the `/ps1` page, provisions SMTP/Turnstile/Google Maps, configures system cron, or proves live behaviour.

Follow [`deployment/wordpress-ps1.md`](deployment/wordpress-ps1.md) for the exact release gates.

## Known open risks and gaps

- The tracked security sign-off is FAIL: no pre-delivery malware control, strict deployed E2E is 0/10, and cleanup/mail failures lack actionable operational alerts.
- Mailbox and downloaded copies can outlive WordPress retention.
- The outcome operation is an authenticated REST endpoint, not a staff-facing workflow.
- Staff-created More Information Requests, full status management, archiving, and automatic ServiceM8 conversion are intentionally absent.
- Approved production System Catalogue imagery is not established in the repository; current system images must not be described as technically approved solely because they are present.
- The WordPress Playground runner is not pinned or documented as one reproducible command.
- The current repository state does not, by itself, prove what plugin version is active on the live site.

## Documentation ownership

- Business language and status meaning: `CONTEXT.md`
- Product and experience boundary: `PRODUCT.md`
- Visual rules: `DESIGN.md`
- Architecture decisions: `docs/adr/`
- Deployment and live checks: `docs/deployment/wordpress-ps1.md`
- Native configuration: `wordpress-native/royal-glass-ps1-native/README.md`
- Release history: `CHANGELOG.md`
- Security evidence: `security/ps1-data-retention-and-upload-safety/`

When code changes one of these truths, update its owning document in the same candidate. Avoid copying secrets, unverified deployment claims, or temporary local working-tree state into permanent documentation.
