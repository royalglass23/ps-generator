import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("plugin exposes a direct shortcode and WordPress REST namespace without an iframe", async () => {
  const source = await readFile(new URL("royal-glass-ps1-native.php", root), "utf8");
  assert.match(source, /add_shortcode\(\s*['\"]royal_glass_ps1['\"]/);
  assert.match(source, /royal-glass-ps1\/v1/);
  assert.doesNotMatch(source, /<iframe\b/i);
});

test("plugin defines dedicated persistence, retention, and mail-outbox tables", async () => {
  const source = await readFile(new URL("includes/class-rg-ps1-database.php", root), "utf8");
  for (const table of ["applications", "uploads", "email_outbox", "rate_limits"]) {
    assert.match(source, new RegExp(`rg_ps1_${table}`));
  }
  assert.match(source, /dbDelta\s*\(/);
});

test("plugin mail uses the PS1 Application sender name without replacing the configured sender address", async () => {
  const source = await readFile(new URL("includes/class-rg-ps1-mailer.php", root), "utf8");
  assert.match(source, /wp_mail_from_name/);
  assert.match(source, /return ['"]PS1 Application['"]/);
  assert.doesNotMatch(source, /wp_mail_from['"]/);
  assert.doesNotMatch(source, /phpmailer_init/);
});

test("applicant submission mail retains the branded Royal Glass confirmation", async () => {
  const source = await readFile(new URL("includes/class-rg-ps1-mailer.php", root), "utf8");
  for (const marker of [
    "We&#039;ve received your application",
    "Royal Glass logo",
    "Your application summary",
    "What happens next",
    "Application reference",
    "See Royal Glass projects and services",
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /'html_body'\s*=>\s*\$applicant_html/);
  assert.doesNotMatch(source, /'html_body'\s*=>\s*nl2br\( esc_html\( \$confirmation \) \)/);
});

test("private upload implementation blocks direct web access", async () => {
  const source = await readFile(new URL("includes/class-rg-ps1-storage.php", root), "utf8");
  assert.match(source, /RG_PS1_PRIVATE_UPLOAD_DIR/);
  assert.match(source, /deny from all/i);
  assert.match(source, /index\.php/);
});

test("staff email attachments keep the applicant's original filename", async () => {
  const storage = await readFile(new URL("includes/class-rg-ps1-storage.php", root), "utf8");
  const mailer = await readFile(new URL("includes/class-rg-ps1-mailer.php", root), "utf8");

  assert.doesNotMatch(storage, /\$original_name\s*=\s*sanitize_file_name/);
  assert.match(mailer, /prepare_attachment\([\s\S]*?\$upload\['original_name'\]/);
  assert.match(mailer, /trailingslashit\( \$this->storage->directory\(\) \)/);
  assert.match(mailer, /\$sent\s*=\s*! \$attachment_error && wp_mail/);
  assert.match(mailer, /finally\s*\{[\s\S]*?cleanup_attachments/);
});

test("bearer credentials are hashed and compared in constant time", async () => {
  const source = await readFile(new URL("includes/class-rg-ps1-service.php", root), "utf8");
  assert.match(source, /hash\(\s*['\"]sha256['\"]/);
  assert.match(source, /hash_equals\s*\(/);
});

test("resumed drafts expose existing upload metadata without exposing storage paths", async () => {
  const source = await readFile(new URL("includes/class-rg-ps1-service.php", root), "utf8");
  assert.match(source, /'uploads'\s*=>\s*array_map/);
  assert.match(source, /'sizeBytes'\s*=>/);
  assert.doesNotMatch(source, /'storedName'\s*=>/);
});

test("module script loading is explicit and upload deletion verifies the file is gone", async () => {
  const plugin = await readFile(new URL("royal-glass-ps1-native.php", root), "utf8");
  const storage = await readFile(new URL("includes/class-rg-ps1-storage.php", root), "utf8");
  assert.match(plugin, /script_loader_tag/);
  assert.match(plugin, /type="module"/);
  assert.match(storage, /wp_delete_file\s*\(/);
  assert.match(storage, /!\s*file_exists\s*\(/);
});

test("PHP signatures stay compatible with the declared PHP 8.1 minimum", async () => {
  const service = await readFile(new URL("includes/class-rg-ps1-service.php", root), "utf8");
  const rest = await readFile(new URL("includes/class-rg-ps1-rest-controller.php", root), "utf8");
  assert.doesNotMatch(`${service}\n${rest}`, /:\s*true\|/);
});

test("editing a field refreshes the current action state without replacing the focused input", async () => {
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  assert.match(app, /input\(event\)[\s\S]*?this\.refreshActionState\(\)/);
  assert.match(app, /refreshActionState\(\)[\s\S]*?continueButton\.disabled\s*=\s*this\.busy\s*\|\|\s*!this\.stepValid\(\)/);
	assert.match(app, /input\.matches\('\[data-field="applicant\.role"\]'\)[\s\S]*?this\.render\(\)/);
});

test("a Turnstile load failure stops automatic remounting and offers an explicit retry", async () => {
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  assert.match(app, /this\.turnstileFailed\s*=\s*true/);
  assert.match(app, /data-action="retry-turnstile"/);
  assert.match(app, /if \(this\.turnstileFailed\)/);
	assert.match(app, /window\.turnstile\.remove\(this\.turnstileWidget\)/);
});

test("the packaging script produces a checksum without requiring optional PowerShell cmdlets", async () => {
  const script = await readFile(new URL("scripts/package.ps1", root), "utf8");
  assert.match(script, /System\.Security\.Cryptography\.SHA256/);
  assert.doesNotMatch(script, /Get-FileHash/);
});

test("strict-risk persistence repairs remain wired", async () => {
  const database = await readFile(new URL("includes/class-rg-ps1-database.php", root), "utf8");
  const service = await readFile(new URL("includes/class-rg-ps1-service.php", root), "utf8");
  assert.match(service, /transaction\([\s\S]*?upload_capacity_for_update/);
  assert.match(database, /FOR UPDATE/);
  assert.match(service, /consume_limit\(\s*'resume_email'/);
  assert.match(database, /RATE_LIMIT_PERSISTENCE_FAILED/);
  assert.match(database, /MAX_EMAIL_ATTEMPTS/);
  assert.match(database, /delete_draft_resume_emails/);
	assert.match(database, /outbox\.kind <> 'draft_resume'[\s\S]*?application\.draft_expires_at >= %s/);
  assert.match(database, /'draft' === \$current\['status'\]/);
});

test("private storage rejects public paths and verifies denial files", async () => {
  const storage = await readFile(new URL("includes/class-rg-ps1-storage.php", root), "utf8");
  assert.match(storage, /array\( ABSPATH, WP_CONTENT_DIR \)/);
  assert.match(storage, /realpath\s*\(/);
  assert.match(storage, /hash_equals\( \$deny/);
});

test("return-link action is absent and recovery paths remain explicit", async () => {
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  assert.doesNotMatch(app, /data-action="save-later"/);
  assert.doesNotMatch(app, /\/resume-link/);
  assert.match(app, /data-action="restart"/);
  assert.match(app, /this\.turnstileToken = "";[\s\S]*?throw error/);
});

test("the WordPress embed does not duplicate site branding and darkens the sticky menu after scrolling", async () => {
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  const styles = await readFile(new URL("assets/app.css", root), "utf8");
  assert.doesNotMatch(app, /class="brand-logo"/);
  assert.doesNotMatch(app, /Secure application/);
  assert.match(app, /window\.scrollY > 0/);
  assert.match(app, /rg-ps1-nav-scrolled/);
  assert.match(styles, /body\.rg-ps1-nav-scrolled #masthead\s*\{[^}]*background-color:\s*#3d3d3d\s*!important/);
  assert.match(styles, /@media \(max-width:\s*1100px\)[\s\S]*?body:has\(\.rg-ps1-native-root\) #masthead\s*\{[^}]*position:\s*absolute/);
  assert.match(styles, /body\.rg-ps1-nav-scrolled:has\(\.rg-ps1-native-root\) #masthead\s*\{[^}]*position:\s*fixed/);
});

test("the WordPress hero breaks out to the viewport and matches the Royal Glass hero rhythm", async () => {
  const styles = await readFile(new URL("assets/app.css", root), "utf8");
  assert.match(styles, /\.rg-ps1-native-root \.portal-masthead\s*\{[^}]*width:\s*100vw[^}]*margin-left:\s*calc\(50% - 50vw\)/);
  assert.match(styles, /\.rg-ps1 \.portal-masthead\s*\{[^}]*min-height:\s*40vh[^}]*align-items:\s*center/);
  assert.match(styles, /\.rg-ps1 \.masthead-content\s*\{[^}]*padding:\s*1\.5rem 0/);
  assert.match(styles, /\.rg-ps1 \.primer span\s*\{[^}]*font-size:\s*1rem/);
});

test("the job address field wires Google Places autocomplete with a manual-entry fallback", async () => {
  const plugin = await readFile(new URL("royal-glass-ps1-native.php", root), "utf8");
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  assert.match(plugin, /RG_PS1_GOOGLE_MAPS_API_KEY/);
  assert.match(plugin, /googleMapsApiKey/);
  assert.match(app, /google\.maps\.importLibrary\("places"\)/);
  assert.match(app, /PlaceAutocompleteElement/);
  assert.match(app, /includedRegionCodes:\s*\["nz"\]/);
  assert.match(app, /data-action="manual-address"/);
  assert.match(app, /field\("project\.address"/);
});

test("selecting a system refreshes its reference image", async () => {
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  assert.match(
    app,
    /input\.matches\('\[data-field="design\.system"\]'\)\)\s*\{[^}]*this\.render\(\)/,
  );
});

test("site areas use radio environments and a multi-select limited to three choices", async () => {
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  assert.match(app, /class="radio-row area-environment"/);
  assert.match(app, /type="radio"[^>]*value="internal"/);
  assert.match(app, /type="radio"[^>]*value="external"/);
  assert.match(app, /<details class="multi-select"/);
  assert.match(app, /type="checkbox"[^>]*data-action="toggle-location"/);
  assert.match(app, /location\.types\.length >= 3/);
  assert.doesNotMatch(app, /<select data-field="site\.locations\.\$\{index\}\.environment"/);
});

test("active upload removal is blocked in both the handler and rendered control", async () => {
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  assert.match(app, /removeUpload\(id\)[\s\S]*?uploadRemovalDisabled\(item\.status\)[\s\S]*?return/);
  assert.match(app, /data-action="remove-upload"[^>]*uploadRemovalDisabled\(item\.status\)/);
});

test("upload rows expose branded progress and customer-facing status", async () => {
  const app = await readFile(new URL("assets/app.js", root), "utf8");
  const styles = await readFile(new URL("assets/app.css", root), "utf8");
  assert.match(app, /uploadStatusLabel\(item\.status\)/);
  assert.match(app, /item\.status\s*===\s*"uploading"[\s\S]*?role="progressbar"/);
  assert.match(app, /aria-label="Uploading \$\{escapeHtml\(item\.name\)\}"/);
  assert.match(styles, /\.upload-progress\s*\{[^}]*background:\s*var\(--rg-line\)/);
  assert.match(styles, /\.upload-progress\s*>\s*span\s*\{[^}]*background:\s*var\(--rg-teal\)/);
  assert.match(styles, /\.file-actions\s*\{[^}]*align-items:\s*baseline/);
  assert.match(styles, /prefers-reduced-motion:[\s\S]*?\.upload-progress\s*>\s*span\s*\{[^}]*animation:\s*none/);
});
