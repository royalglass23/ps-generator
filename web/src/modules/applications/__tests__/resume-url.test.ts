import { describe, expect, it } from "vitest";

import { buildResumeUrl } from "../resume-url";

describe("buildResumeUrl", () => {
  it("builds the existing direct application URL when no public wrapper is configured", () => {
    expect(buildResumeUrl({
      applicationBaseUrl: "https://ps1-app.example.test/",
      applicationId: "11111111-1111-4111-8111-111111111111",
      resumeToken: "secret token",
    })).toBe(
      "https://ps1-app.example.test/application/11111111-1111-4111-8111-111111111111#token=secret%20token",
    );
  });

  it("builds a Royal Glass WordPress resume URL when the public page is configured", () => {
    expect(buildResumeUrl({
      applicationBaseUrl: "https://ps1-app.example.test",
      publicApplicationUrl: "https://royalglass.co.nz/ps1/",
      applicationId: "11111111-1111-4111-8111-111111111111",
      resumeToken: "secret token",
    })).toBe(
      "https://royalglass.co.nz/ps1/?application=11111111-1111-4111-8111-111111111111#token=secret%20token",
    );
  });
});
