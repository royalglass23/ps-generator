import { z } from "zod";

import { getAbuseConfig } from "@/lib/config";
import { ApplicationError } from "@/modules/applications/errors";

const responseSchema = z.object({ success: z.boolean() }).passthrough();

export async function verifyTurnstile(token: string, remoteIp?: string): Promise<void> {
  const { TURNSTILE_SECRET_KEY } = getAbuseConfig();
  const body = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(5_000),
  });
  const parsed = responseSchema.safeParse(await response.json());
  if (!response.ok || !parsed.success || !parsed.data.success) {
    throw new ApplicationError("ABUSE_CHECK_FAILED", "The security check was not accepted.");
  }
}
