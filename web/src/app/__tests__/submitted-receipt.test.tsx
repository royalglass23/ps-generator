// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationForm } from "../application-form";
import { SubmittedReceipt } from "../submitted-receipt";

const validDraftPayload = {
  need: "ps1",
  applicant: {
    name: "Jordan Applicant",
    mobile: "021 555 0101",
    email: "jordan@example.test",
    role: "homeowner",
  },
  project: {
    address: "13 Example Street, Auckland",
    buildingConsentNumber: "",
    resourceConsentNumber: "",
    estimatedInstallation: "not_sure",
  },
  design: { family: "balustrade", system: "double-disc" },
  site: { substrate: "timber", locations: [] },
};

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button"))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

describe("SubmittedReceipt", () => {
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.body.innerHTML = '<div id="root"></div>';
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/application/submitted");
    root = createRoot(document.querySelector("#root")!);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it("does not claim an application was received without a stored receipt", async () => {
    await act(async () => root.render(<SubmittedReceipt />));

    expect(document.body.textContent).not.toContain("Application received");
    expect(document.body.textContent).toContain("Receipt unavailable");
  });

  it("removes the resume token after the real form submits and restores the receipt", async () => {
    window.history.replaceState({}, "", "/application/draft-1#token=resume-secret");
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/submit")) {
        return Response.json({
          reference: "PS1-2026-ABC12345",
          submittedAt: "2026-10-05T01:23:45.000Z",
        });
      }
      if (init?.method === "PUT") return Response.json({ status: "draft" });
      return Response.json({ payload: validDraftPayload });
    });
    vi.stubGlobal("fetch", fetcher);

    await act(async () => root.render(
      <ApplicationForm siteKey="" googleMapsApiKey="" draftId="draft-1" />,
    ));
    await settle();
    expect(document.body.textContent).toContain("Saved application restored");

    for (let step = 0; step < 5; step += 1) {
      await act(async () => button("Continue").click());
      await settle();
    }

    const acknowledgement = document.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(acknowledgement).not.toBeNull();
    await act(async () => acknowledgement!.click());
    await act(async () => button("Submit application").click());
    await settle();

    expect(fetcher).toHaveBeenCalledWith(
      "/api/applications/drafts/draft-1/submit",
      expect.objectContaining({ method: "POST" }),
    );
    expect(window.location.pathname).toBe("/application/submitted");
    expect(window.location.hash).toBe("");
    expect(document.body.textContent).toContain("PS1-2026-ABC12345");

    await act(async () => root.unmount());
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.querySelector("#root")!);
    await act(async () => root.render(<SubmittedReceipt />));

    expect(document.body.textContent).toContain("PS1-2026-ABC12345");
    expect(document.body.textContent).toContain("jordan@example.test");
    expect(document.body.textContent).not.toContain("Receipt unavailable");
  });
});
