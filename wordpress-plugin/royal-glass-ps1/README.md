# Royal Glass PS1 WordPress wrapper

This plugin registers the `[royal_glass_ps1]` shortcode. The shortcode embeds the separately hosted PS1 application while the public page remains under the Royal Glass WordPress site.

## Deployment order

1. Obtain explicit approval before committing or pushing the application candidate.
2. Import the GitHub repository `royalglass23/ps-generator` into Vercel with `web` as the Root Directory and Next.js as the framework.
3. Configure all variables from `web/.env.example`, including:

   ```text
   PUBLIC_APPLICATION_URL=https://royalglass.co.nz/ps1/
   WORDPRESS_EMBED_ORIGIN=https://royalglass.co.nz
   ```

4. Apply only reviewed and explicitly approved database migrations, configure R2/Resend/Turnstile/Google Maps, then deploy and record the final technical HTTPS URL.
5. Back up `wp-config.php`, then add that technical URL:

   ```php
   define('RG_PS1_APP_URL', 'https://your-deployed-application.example/');
   ```

6. Upload and activate `royal-glass-ps1.zip` in WordPress.
7. Create a full-width WordPress page at `/ps1` containing `[royal_glass_ps1]`.
8. Keep the page unpublished until desktop/mobile resume, refresh, upload, submission, email, URL cleanup, and unrelated-origin blocking checks pass.

The complete operator checklist is in the repository at `docs/deployment/wordpress-ps1.md`. GitHub state, Vercel deployment, provider setup, plugin installation, and WordPress publication are separate approval gates.
