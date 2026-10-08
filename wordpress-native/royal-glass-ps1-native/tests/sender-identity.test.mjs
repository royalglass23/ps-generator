import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("plugin mail changes only the sender name for its scoped wp_mail call", async () => {
  const source = await readFile(new URL("includes/class-rg-ps1-mailer.php", root), "utf8");
  assert.match(source, /wp_mail_from_name/);
  assert.match(source, /return ['"]PS1 Application['"]/);
  assert.match(source, /add_filter\(\s*['"]wp_mail_from_name['"]/);
  assert.match(source, /remove_filter\(\s*['"]wp_mail_from_name['"]/);
  assert.doesNotMatch(source, /wp_mail_from['"]/);
  assert.doesNotMatch(source, /phpmailer_init/);
  assert.doesNotMatch(source, /setFrom\s*\(/);
});
