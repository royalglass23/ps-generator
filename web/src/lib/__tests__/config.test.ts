import { afterEach, describe, expect, it } from "vitest";

import { getDatabaseConfig } from "@/lib/config";

const originalDatabaseUrlProd = process.env.DATABASE_URL_PROD;

afterEach(() => {
  if (originalDatabaseUrlProd === undefined) {
    delete process.env.DATABASE_URL_PROD;
  } else {
    process.env.DATABASE_URL_PROD = originalDatabaseUrlProd;
  }
});

describe("database configuration", () => {
  it("reads the canonical DATABASE_URL_PROD variable", () => {
    process.env.DATABASE_URL_PROD = "postgresql://example.test/ps1";

    expect(getDatabaseConfig()).toEqual({
      DATABASE_URL_PROD: "postgresql://example.test/ps1",
    });
  });
});
