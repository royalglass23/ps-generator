import { createHmac } from "node:crypto";

import { ApplicationError } from "@/modules/applications/errors";

export type RateLimitScope = "draft_create" | "upload_reserve";

export interface RateLimitRepository {
  consume(input: {
    scope: RateLimitScope;
    keyHash: string;
    windowStartedAt: Date;
    expiresAt: Date;
    limit: number;
  }): Promise<boolean>;
  deleteExpired?(now: Date): Promise<number>;
}

interface RateLimiterDependencies {
  repository: RateLimitRepository;
  secret: string;
  now?: () => Date;
  windowMs?: number;
}

export class RateLimiter {
  private readonly now: () => Date;
  private readonly windowMs: number;

  constructor(private readonly dependencies: RateLimiterDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.windowMs = dependencies.windowMs ?? 60 * 60 * 1_000;
  }

  async consume(input: {
    scope: RateLimitScope;
    identifier: string;
    limit: number;
  }): Promise<void> {
    const now = this.now();
    const windowStartedAt = new Date(Math.floor(now.getTime() / this.windowMs) * this.windowMs);
    const keyHash = createHmac("sha256", this.dependencies.secret)
      .update(`${input.scope}\0${input.identifier}`, "utf8")
      .digest("hex");
    const accepted = await this.dependencies.repository.consume({
      scope: input.scope,
      keyHash,
      windowStartedAt,
      expiresAt: new Date(windowStartedAt.getTime() + this.windowMs * 2),
      limit: input.limit,
    });
    if (!accepted) {
      throw new ApplicationError("RATE_LIMITED", "Too many requests. Please try again later.");
    }
  }
}
