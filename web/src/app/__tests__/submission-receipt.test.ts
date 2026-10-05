import { describe, expect, it } from "vitest";

import {
  loadSubmissionReceipt,
  persistSubmissionReceipt,
} from "../submission-receipt";

function memoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("submission receipt", () => {
  it("replaces the tokenized draft URL and restores the receipt after refresh", () => {
    const storage = memoryStorage();
    const replacedUrls: string[] = [];
    const receipt = {
      reference: "PS1-2026-ABC12345",
      submittedAt: "2026-10-05T01:23:45.000Z",
      email: "jordan@example.test",
    };

    persistSubmissionReceipt(receipt, {
      storage,
      replaceUrl(url) {
        replacedUrls.push(url);
      },
    });

    expect(replacedUrls).toEqual(["/application/submitted"]);
    expect(replacedUrls[0]).not.toContain("token");
    expect(loadSubmissionReceipt(storage)).toEqual(receipt);
  });
});
