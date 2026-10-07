import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("plugin mail uses the configured support address with the PS1 Generator sender name", async () => {
  const source = await readFile(new URL("includes/class-rg-ps1-mailer.php", root), "utf8");
  assert.match(source, /wp_mail_from_name/);
  assert.match(source, /wp_mail_from/);
  assert.match(source, /return ['"]PS1 Generator['"]/);
  assert.match(source, /sender_address[\s\S]*?RG_PS1_SUPPORT_EMAIL/);
  assert.match(source, /add_action\(\s*['"]phpmailer_init['"]/);
  assert.match(source, /setFrom\(\s*\$sender_address,\s*['"]PS1 Generator['"],\s*false\s*\)/);
});
