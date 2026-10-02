import { lt, sql } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";

import type { RateLimitRepository } from "./rate-limiter";

export class DrizzleRateLimitRepository implements RateLimitRepository {
  constructor(private readonly db: Database) {}

  async consume(input: Parameters<RateLimitRepository["consume"]>[0]): Promise<boolean> {
    const [row] = await this.db
      .insert(rateLimits)
      .values({
        scope: input.scope,
        keyHash: input.keyHash,
        windowStartedAt: input.windowStartedAt,
        expiresAt: input.expiresAt,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [rateLimits.scope, rateLimits.keyHash, rateLimits.windowStartedAt],
        set: { count: sql`${rateLimits.count} + 1`, expiresAt: input.expiresAt },
        where: lt(rateLimits.count, input.limit),
      })
      .returning({ count: rateLimits.count });
    return Boolean(row);
  }

  async deleteExpired(now: Date): Promise<number> {
    const rows = await this.db
      .delete(rateLimits)
      .where(lt(rateLimits.expiresAt, now))
      .returning({ keyHash: rateLimits.keyHash });
    return rows.length;
  }
}
