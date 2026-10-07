import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("optional structurally valid uploads are ready for the staff review email without a server scanner", async () => {
  const [plugin, service, database, rest, mailer] = await Promise.all([
    source("royal-glass-ps1-native.php"),
    source("includes/class-rg-ps1-service.php"),
    source("includes/class-rg-ps1-database.php"),
    source("includes/class-rg-ps1-rest-controller.php"),
    source("includes/class-rg-ps1-mailer.php"),
  ]);

  assert.doesNotMatch(plugin, /RG_PS1_CLAMAV_PATH|RG_PS1_File_Scanner|rg_ps1_native_scan_uploads/);
  assert.doesNotMatch(rest, /UPLOAD_SCANNER_UNAVAILABLE|scanner->is_configured/);
  assert.match(service, /'status'\s*=>\s*'ready'/);
  assert.doesNotMatch(service, /scan_upload|scan_pending|quarantined/);
  assert.match(database, /status varchar\(30\) NOT NULL DEFAULT 'ready'/);
  assert.doesNotMatch(database, /scan_deadline_at|migration_pending/);
  assert.match(mailer, /'attachment_ids'\s*=>\s*wp_json_encode\(\s*\$ids\s*\)/);
  assert.match(mailer, /'attachment_ids'\s*=>\s*'\[\]'/);
});

test("WordPress intake retention enforces 14, 30, and 7 day boundaries", async () => {
  const [database, service, rest] = await Promise.all([
    source("includes/class-rg-ps1-database.php"),
    source("includes/class-rg-ps1-service.php"),
    source("includes/class-rg-ps1-rest-controller.php"),
  ]);

  assert.match(database, /review_escalated_at/);
  assert.match(database, /retention_expires_at/);
  assert.match(service, /14\s*\*\s*DAY_IN_SECONDS/);
  assert.match(service, /30\s*\*\s*DAY_IN_SECONDS/);
  assert.match(service, /7\s*\*\s*DAY_IN_SECONDS/);
  assert.match(rest, /record_outcome/);
  assert.match(rest, /current_user_can\(\s*'manage_options'\s*\)/);
});

test("submission is a staff review notification, not automatic ServiceM8 handoff", async () => {
  const mailer = await source("includes/class-rg-ps1-mailer.php");
  assert.doesNotMatch(mailer, /RG_PS1_SERVICEM8_EMAIL/);
  assert.match(mailer, /submission_internal/);
  assert.match(mailer, /RG_PS1_REVIEW_EMAIL/);
});
