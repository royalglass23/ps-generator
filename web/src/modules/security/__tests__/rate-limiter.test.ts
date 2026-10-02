import { describe, expect, it } from "vitest";

import { RateLimiter } from "../rate-limiter";

describe("RateLimiter", () => {
  it("stores an HMAC identifier and rejects a request after the configured limit", async () => {
    const capturedKeys: string[] = [];
    let count = 0;
    const limiter = new RateLimiter({
      repository: {
        consume: async (input) => {
          capturedKeys.push(input.keyHash);
          count += 1;
          return count <= input.limit;
        },
      },
      secret: "a-development-secret-that-is-at-least-32-characters",
      now: () => new Date("2026-10-02T00:15:00.000Z"),
    });

    await expect(
      limiter.consume({ scope: "draft_create", identifier: "203.0.113.10", limit: 2 }),
    ).resolves.toBeUndefined();
    await expect(
      limiter.consume({ scope: "draft_create", identifier: "203.0.113.10", limit: 2 }),
    ).resolves.toBeUndefined();
    await expect(
      limiter.consume({ scope: "draft_create", identifier: "203.0.113.10", limit: 2 }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    expect(capturedKeys[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(capturedKeys[0]).not.toContain("203.0.113.10");
    expect(new Set(capturedKeys)).toHaveLength(1);
  });

  it("uses separate buckets for separate scopes", async () => {
    const keys: string[] = [];
    const limiter = new RateLimiter({
      repository: {
        consume: async (input) => {
          keys.push(input.keyHash);
          return true;
        },
      },
      secret: "a-development-secret-that-is-at-least-32-characters",
      now: () => new Date("2026-10-02T00:15:00.000Z"),
    });

    await limiter.consume({ scope: "draft_create", identifier: "same", limit: 5 });
    await limiter.consume({ scope: "upload_reserve", identifier: "same", limit: 10 });

    expect(keys[0]).not.toBe(keys[1]);
  });
});
