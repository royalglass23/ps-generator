import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDraftPayload,
  buildSubmissionPayload,
  initialJourneyState,
  nextLocationTypes,
  uploadRemovalDisabled,
  validateInput,
  validateUpload,
} from "../assets/domain.mjs";

function completeState() {
  return {
    ...structuredClone(initialJourneyState),
    need: "ps1",
    applicant: {
      name: "Aroha Ngata",
      mobile: "021 123 4567",
      email: "aroha@example.co.nz",
      role: "homeowner",
      decisionMaker: { name: "", mobile: "", email: "" },
    },
    project: {
      address: "12 Queen Street, Auckland",
      buildingConsentNumber: "BC-123",
      resourceConsentNumber: "",
      estimatedInstallation: "3_months",
      stage: "preparing_consent",
    },
    design: { family: "balustrade", system: "double-disc" },
    site: {
      substrate: "concrete",
      locations: [{ types: ["deck"], environment: "external", other: "" }],
    },
    acknowledgement: true,
  };
}

test("validates the reusable PS1 input rules", () => {
  assert.equal(validateInput("name", "Aroha Ngata"), null);
  assert.match(validateInput("mobile", "123") ?? "", /valid NZ/i);
  assert.equal(validateInput("email", "person@example.co.nz"), null);
  assert.match(validateInput("address", ""), /job address/i);
});

test("preserves pool-area exclusivity", () => {
  assert.deepEqual(nextLocationTypes(["deck"], "pool-area"), ["pool-area"]);
  assert.deepEqual(nextLocationTypes(["pool-area"], "deck"), ["deck"]);
});

test("limits an area to three selected location types", () => {
  assert.deepEqual(nextLocationTypes(["deck", "balcony", "stair"], "landing"), ["deck", "balcony", "stair"]);
  assert.deepEqual(nextLocationTypes(["deck", "balcony", "stair"], "balcony"), ["deck", "stair"]);
});

test("prevents removal while an upload or deletion request is active", () => {
  assert.equal(uploadRemovalDisabled("uploading"), true);
  assert.equal(uploadRemovalDisabled("removing"), true);
  assert.equal(uploadRemovalDisabled("uploaded"), false);
  assert.equal(uploadRemovalDisabled("failed"), false);
});

test("builds draft and submission payloads without leaking inactive decision-maker fields", () => {
  const state = completeState();
  assert.equal(buildDraftPayload(state).applicant.decisionMaker, undefined);
  assert.deepEqual(buildSubmissionPayload(state).acknowledgement, { accepted: true });
});

test("requires decision-maker details for architect and builder submissions", () => {
  const state = completeState();
  state.applicant.role = "architect";
  assert.throws(() => buildSubmissionPayload(state), /decision-maker/i);
});

test("enforces the existing upload type and size contract", () => {
  assert.equal(validateUpload({ name: "plan.pdf", type: "application/pdf", size: 1024 }), null);
  assert.match(validateUpload({ name: "script.php", type: "text/php", size: 10 }) ?? "", /PDF, JPG, PNG or DWG/);
  assert.match(validateUpload({ name: "large.pdf", type: "application/pdf", size: 11 * 1024 * 1024 }) ?? "", /10 MB/);
});
