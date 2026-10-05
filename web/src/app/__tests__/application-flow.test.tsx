import { describe, expect, it } from "vitest";

import { applicationStepLabels } from "../application-form";

describe("application flow", () => {
  it("keeps applicant details last in the six-section quick journey", () => {
    expect(applicationStepLabels).toEqual([
      "What you need",
      "Project details",
      "Design",
      "Site conditions",
      "Documents & images",
      "Applicant details",
    ]);
  });
});
