import { afterEach, describe, expect, it } from "vitest";

import { getApplicationConfig, getDatabaseConfig } from "@/lib/config";

const originalDatabaseUrlProd = process.env.DATABASE_URL_PROD;
const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalPublicApplicationUrl = process.env.PUBLIC_APPLICATION_URL;
const originalWordPressEmbedOrigin = process.env.WORDPRESS_EMBED_ORIGIN;

afterEach(() => {
  if (originalDatabaseUrlProd === undefined) {
    delete process.env.DATABASE_URL_PROD;
  } else {
    process.env.DATABASE_URL_PROD = originalDatabaseUrlProd;
  }
  for (const [name, value] of [
    ["APP_BASE_URL", originalAppBaseUrl],
    ["PUBLIC_APPLICATION_URL", originalPublicApplicationUrl],
    ["WORDPRESS_EMBED_ORIGIN", originalWordPressEmbedOrigin],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("application configuration", () => {
  it("treats blank optional WordPress integration values as unset", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.PUBLIC_APPLICATION_URL = "";
    process.env.WORDPRESS_EMBED_ORIGIN = "";

    expect(getApplicationConfig()).toEqual({
      APP_BASE_URL: "http://localhost:3000",
    });
  });

  it.each([
    ["WORDPRESS_EMBED_ORIGIN", "http://royalglass.co.nz"],
    ["WORDPRESS_EMBED_ORIGIN", "https://royalglass.co.nz/ps1"],
    ["WORDPRESS_EMBED_ORIGIN", "javascript:alert(1)"],
    ["PUBLIC_APPLICATION_URL", "http://royalglass.co.nz/ps1/"],
    ["PUBLIC_APPLICATION_URL", "ftp://royalglass.co.nz/ps1/"],
  ])("rejects unsafe %s value %s", (name, value) => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.PUBLIC_APPLICATION_URL = "";
    process.env.WORDPRESS_EMBED_ORIGIN = "";
    process.env[name] = value;

    expect(() => getApplicationConfig()).toThrow(`Invalid application configuration: ${name}`);
  });

  it("normalizes the configured WordPress origin", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.PUBLIC_APPLICATION_URL = "https://royalglass.co.nz/ps1/";
    process.env.WORDPRESS_EMBED_ORIGIN = "https://royalglass.co.nz/";

    expect(getApplicationConfig()).toEqual({
      APP_BASE_URL: "http://localhost:3000",
      PUBLIC_APPLICATION_URL: "https://royalglass.co.nz/ps1/",
      WORDPRESS_EMBED_ORIGIN: "https://royalglass.co.nz",
    });
  });
});

describe("database configuration", () => {
  it("reads the canonical DATABASE_URL_PROD variable", () => {
    process.env.DATABASE_URL_PROD = "postgresql://example.test/ps1";

    expect(getDatabaseConfig()).toEqual({
      DATABASE_URL_PROD: "postgresql://example.test/ps1",
    });
  });
});
