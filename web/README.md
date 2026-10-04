# Royal Glass PS1 portal backend

Local backend foundation for the PS1 application journey. It is a Next.js application intended for Vercel, with Neon PostgreSQL, private Cloudflare R2 storage, and Resend delivery.

## Implemented journey

- Creates a draft with an opaque resume token; only its SHA-256 hash is stored.
- Saves and reloads an authorized draft and rolls its expiry forward seven days.
- Validates submission against the fields currently required by the prototype.
- Locks applicant editing after submission.
- Reserves uploads atomically, sends the browser directly to R2, then checks size, content type, and file signature before accepting the object.
- Queues the internal ServiceM8/support message and applicant confirmation in the same database transaction as submission.
- Sends the internal email with the uploaded plans attached through short-lived R2 download URLs.
- Attempts queued email delivery immediately after submission and information responses, while retaining a claimed outbox, retries, and stable Resend idempotency keys for reliability.
- Enforces atomic, Neon-backed fixed-window limits before draft allocation and upload reservation; only HMAC identifiers are stored.
- Accepts an applicant response only for a matching open More Information Request.
- Claims and removes expired drafts and their R2 objects through an authenticated daily cron.

Staff routes are deliberately not public yet. Creating a More Information Request, changing an official status, archiving, and converting to a ServiceM8 job card require a staff authentication decision before those endpoints are added.

## Local setup

1. Copy `.env.example` to `.env.local` inside this `web` directory and insert the local/development values. Do not commit that file.
2. Use a development Neon database or local PostgreSQL database. Do not point local testing at production.
3. Generate a long random `CRON_SECRET` of at least 24 characters and use a Cloudflare Turnstile development/test secret locally.
4. Install and validate:

   ```powershell
   npm install
   npm test
   npm run typecheck
   npm run lint
   npm run build
   npm run dev
   ```

No database migration is applied by these commands. The generated SQL is under `drizzle/` and must be reviewed before it is applied to any database.

## Environment variables

The application reads exactly the R2 variable names already chosen for this project:

- `R2_BUCKET_NAME_PS1`
- `R2_ENDPOINT_PS1`
- `R2_ACCESS_KEY_ID_PS1`
- `R2_SECRET_ACCESS_KEY_PS1`
- `R2_REGION=auto`

It also requires `DATABASE_URL_PROD`, `RESEND_API_KEY`, `INTERNAL_EMAIL_FROM`, `APPLICANT_EMAIL_FROM`, `SUPPORT_EMAIL`, `SERVICEM8_INBOX_EMAIL`, `APP_BASE_URL`, `DRAFT_RETENTION_DAYS`, `CRON_SECRET`, the public `TURNSTILE_SITE_KEY`, the private `TURNSTILE_SECRET_KEY`, and an independent random `RATE_LIMIT_SECRET` of at least 32 characters. `DRAFT_RATE_LIMIT_PER_HOUR` defaults to 5 and `UPLOAD_RATE_LIMIT_PER_HOUR` defaults to 10. Configuration is parsed lazily so a missing provider credential fails only a route that needs that provider, without exposing its value.

## Applicant API

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/applications/drafts` | Verify Turnstile, then create a draft and return its one-time resume credential. |
| `GET` | `/api/applications/drafts/:id` | Load an authorized, unexpired draft. |
| `PUT` | `/api/applications/drafts/:id` | Save a draft and renew its seven-day expiry. |
| `POST` | `/api/applications/drafts/:id/uploads` | Atomically reserve capacity and return a signed R2 `PUT` URL. |
| `POST` | `/api/applications/drafts/:id/uploads/:uploadId/complete` | Inspect and accept the uploaded R2 object. |
| `POST` | `/api/applications/drafts/:id/submit` | Validate, submit, lock, and queue notifications. |
| `POST` | `/api/applications/drafts/:id/information-requests/:requestId/responses` | Respond to an open staff request. |

Authorized applicant calls use `Authorization: Bearer <resumeToken>`. The resume URL places the token in the URL fragment so browsers do not send it in HTTP request logs.

Draft creation expects `{ "turnstileToken": "..." }`. Upload reservation expects the filename, content type, byte size, and optional information-request ID as JSON. The browser then uploads directly to the returned R2 URL with the returned headers and calls the completion route. Configure the private R2 bucket CORS policy to allow `PUT` from the application origin and the `Content-Type` request header.

Draft limits are keyed by an HMAC of the Vercel-provided client IP. Upload limits are keyed by an HMAC of the authorized application ID, so an unauthenticated caller cannot exhaust another application’s bucket. The daily cleanup job removes expired limiter buckets alongside expired drafts.

Uploads currently allow PDF, JPEG, PNG, and DWG, up to five files, 10 MiB per file, and 25 MiB combined per upload context. Capacity is reserved inside a PostgreSQL row lock, and completion checks the stored object rather than trusting browser metadata. The combined limit keeps the ServiceM8 email below the provider attachment ceiling with encoding overhead.

## Scheduled workers

`vercel.json` declares:

- `/api/cron/email-outbox` daily as a free-plan retry sweep; normal delivery is attempted immediately after each application event queues email.
- `/api/cron/draft-cleanup` daily.

Both require `Authorization: Bearer <CRON_SECRET>`. They are code only until the project is deployed; local validation does not call Resend, R2, Neon, ServiceM8, or Vercel.

## Current boundary

This slice provides the backend and provider adapters. It does not connect the existing prototype UI, apply the generated migrations, deploy, create Vercel resources, send real email, or expose staff actions. Those are separate, explicit release steps.
