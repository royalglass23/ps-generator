# WordPress `/ps1` deployment

The public PS1 page is `https://royalglass.co.nz/ps1/`. WordPress supplies the Royal Glass page shell, and the `[royal_glass_ps1]` shortcode embeds the separately hosted Next.js application.

## 1. Prepare the WordPress page

1. Create a page titled **PS1 Application** with slug `ps1`.
2. Select the site's full-width page template.
3. Add only `[royal_glass_ps1]` to the page content.
4. Keep the page as a draft until the application and plugin pass the live end-to-end checks.
5. Exclude `/ps1` from session replay and any analytics configuration that captures query strings, URL fragments, or form content. Resume links arrive with a private access token in the URL fragment; the wrapper consumes and removes it before initializing the iframe.

## 2. Deploy the application

Do not start this section until the reviewed candidate has explicit commit and push approval. A local build or GitHub connection is not a production deployment.

### Connect GitHub to Vercel

1. Sign in to Vercel using the Royal Glass deployment account.
2. Choose **Add New → Project**, then import `royalglass23/ps-generator` from GitHub.
3. Set **Framework Preset** to **Next.js** and **Root Directory** to `web`.
4. Leave the standard install and build commands as `npm install` and `npm run build` unless the repository changes.
5. Select only the branch explicitly approved for production. The current candidate is on `dev`; pushing it does not itself authorize a production deployment.
6. Do not click **Deploy** until the environment variables and provider resources below are ready.

### Configure Vercel environment variables

Enter the complete variable set from `web/.env.example` in Vercel. Never place secret values in GitHub, WordPress content, or this guide. In addition to the database, R2, Resend, Turnstile, Google Maps, rate-limit, and cron values, configure:

```text
APP_BASE_URL=https://the-technical-application-host.example
PUBLIC_APPLICATION_URL=https://royalglass.co.nz/ps1/
WORDPRESS_EMBED_ORIGIN=https://royalglass.co.nz
```

`APP_BASE_URL` is the technical application origin. `PUBLIC_APPLICATION_URL` is the customer-facing WordPress page used for resume links. `WORDPRESS_EMBED_ORIGIN` restricts embedding and iframe messages to the live Royal Glass website.

### Prepare the external providers

1. Create or select the production Neon database. Review and explicitly approve the generated SQL before applying any migration.
2. Configure the private R2 bucket and allow `PUT` CORS requests only from the technical application origin.
3. Verify the Resend sender domains and Royal Glass sender addresses.
4. Add the technical application hostname to the Cloudflare Turnstile widget.
5. Restrict the Google Maps browser key to the technical application hostname.
6. Generate independent production values for `CRON_SECRET` and `RATE_LIMIT_SECRET`.

### Deploy and record the technical URL

1. After commit, push, migration, and deployment approval, deploy the imported Vercel project.
2. Wait for the Vercel build to complete successfully; a GitHub push alone is not proof of deployment.
3. Open `/api/health` on the Vercel deployment and record the final HTTPS application origin.
4. Update `APP_BASE_URL` to that exact origin if Vercel initially used a temporary preview URL, then redeploy.
5. Do not publish the WordPress page yet.

## 3. Install the WordPress wrapper

1. In cPanel File Manager, open the active WordPress installation and back up the current `wp-config.php` before editing it.
2. Add the deployed application URL to `wp-config.php`, before the `stop editing` comment:

   ```php
   define('RG_PS1_APP_URL', 'https://the-technical-application-host.example/');
   ```

3. Upload `royal-glass-ps1.zip` through **WordPress Admin → Plugins → Add New → Upload Plugin** and activate **Royal Glass PS1 Application**. The ZIP installs under `wp-content/plugins/royal-glass-ps1/`; it does not contain the Next.js application or any provider secret.
4. Clear the WordPress/page cache and Cloudflare cache for `/ps1`.
5. Preview the draft `/ps1` page. Administrators see a configuration notice instead of a broken iframe if the constant is absent or invalid.

## 4. Live acceptance checks

Before publishing, verify in a private/incognito browser on desktop and mobile:

1. `/ps1` shows one Royal Glass header and footer around the application.
2. The iframe height follows every step without nested scrollbars or clipped controls.
3. Turnstile and Google address suggestions load; manual address entry remains available.
4. Starting a draft adds only its application ID to the parent `/ps1` URL; refreshing restores it without placing the bearer token in the WordPress URL.
5. PDF, JPEG, PNG, and DWG upload paths work against the production R2 bucket.
6. Submission produces one application, the applicant confirmation, and the internal ServiceM8/support message.
7. The emailed resume link returns to `/ps1`, restores the correct draft, and the wrapper immediately removes its token fragment before initializing the iframe.
8. The application cannot be embedded by an unrelated origin.
9. Successful submission removes `application` and the fragment from the parent `/ps1` URL, and refreshing does not try to reopen the locked draft.

Publish `/ps1` only after these checks pass and publication is explicitly approved. GitHub state, application deployment, provider configuration, WordPress installation, live acceptance, and page publication are separate gates.
