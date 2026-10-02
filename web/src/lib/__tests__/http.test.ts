import { describe, expect, it } from "vitest";

import { errorResponse, requestIp } from "../http";
import { ApplicationError } from "@/modules/applications/errors";

describe("HTTP security helpers", () => {
  it("maps exhausted rate limits to 429 without returning identifier details", async () => {
    const response = errorResponse(new ApplicationError("RATE_LIMITED", "Too many requests"));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "RATE_LIMITED" });
  });

  it("uses only the first proxy-provided client address", () => {
    const request = new Request("https://example.test", {
      headers: { "x-vercel-forwarded-for": "203.0.113.10, 198.51.100.2" },
    });

    expect(requestIp(request)).toBe("203.0.113.10");
  });
});
