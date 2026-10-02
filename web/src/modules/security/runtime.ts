import { getAbuseConfig } from "@/lib/config";
import { getDatabase } from "@/lib/db/client";

import { DrizzleRateLimitRepository } from "./drizzle-rate-limit-repository";
import { RateLimiter } from "./rate-limiter";

let rateLimiter: RateLimiter | undefined;

function resources() {
  const config = getAbuseConfig();
  rateLimiter ??= new RateLimiter({
    repository: new DrizzleRateLimitRepository(getDatabase()),
    secret: config.RATE_LIMIT_SECRET,
  });
  return { rateLimiter, config };
}

export async function limitDraftCreation(identifier: string): Promise<void> {
  const { rateLimiter: limiter, config } = resources();
  await limiter.consume({
    scope: "draft_create",
    identifier,
    limit: config.DRAFT_RATE_LIMIT_PER_HOUR,
  });
}

export async function limitUploadReservation(applicationId: string): Promise<void> {
  const { rateLimiter: limiter, config } = resources();
  await limiter.consume({
    scope: "upload_reserve",
    identifier: applicationId,
    limit: config.UPLOAD_RATE_LIMIT_PER_HOUR,
  });
}
