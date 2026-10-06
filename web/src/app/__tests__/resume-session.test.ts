import { describe, expect, it } from "vitest";

import {
  clearResumeToken,
  rememberResumeToken,
  resolveResumeToken,
} from "../resume-session";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("embedded resume session", () => {
  it("consumes a fragment token into application-origin session storage", () => {
    const storage = new MemoryStorage();

    expect(resolveResumeToken("draft-1", "#token=secret%20token", storage)).toEqual({
      token: "secret token",
      consumedFragment: true,
    });
    expect(resolveResumeToken("draft-1", "", storage)).toEqual({
      token: "secret token",
      consumedFragment: false,
    });
  });

  it("remembers a newly created draft and clears it after submission", () => {
    const storage = new MemoryStorage();

    expect(rememberResumeToken("draft-1", "new-secret", storage)).toBe(true);
    expect(resolveResumeToken("draft-1", "", storage)?.token).toBe("new-secret");

    clearResumeToken("draft-1", storage);
    expect(resolveResumeToken("draft-1", "", storage)).toBeNull();
  });
});
