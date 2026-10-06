// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationForm } from "../application-form";

vi.mock("next/script", async () => {
  const React = await import("react");
  return {
    default: function MockScript({ onReady }: { onReady?: () => void }) {
      const onReadyRef = React.useRef(onReady);
      React.useEffect(() => onReadyRef.current?.(), []);
      return null;
    },
  };
});

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

function button(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button"))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function control(label: string): HTMLInputElement | HTMLSelectElement {
  const match = Array.from(document.querySelectorAll("label")).find((candidate) =>
    candidate.querySelector("span")?.textContent?.startsWith(label),
  )?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
  if (!match) throw new Error(`Control not found: ${label}`);
  return match;
}

function setControlValue(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = input instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("role-specific homeowner details", () => {
  let root: Root;

  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.body.innerHTML = '<div id="root"></div>';
    history.replaceState({}, "", "/application/draft-1#token=resume-secret");
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (!init?.method) return Response.json({ payload: validDraftPayload });
      return new Response(null, { status: 204 });
    }));
    root = createRoot(document.querySelector("#root")!);
    await act(async () => root.render(
      <ApplicationForm siteKey="" googleMapsApiKey="" draftId="draft-1" />,
    ));
    await settle();
    for (let step = 0; step < 5; step += 1) {
      await act(async () => button("Continue").click());
      await settle();
    }
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it("shows required validated details for architect or builder and clears them for other roles", async () => {
    expect(document.body.textContent).not.toContain("Homeowner or decision-maker details");

    await act(async () => setControlValue(control("Role"), "architect"));
    expect(document.body.textContent).toContain("Homeowner or decision-maker details");
    expect(control("Homeowner or decision-maker name")).toHaveProperty("required", true);
    expect(control("Homeowner or decision-maker email")).toHaveProperty("required", true);
    expect(control("Homeowner or decision-maker phone")).toHaveProperty("required", true);

    await act(async () => setControlValue(control("Homeowner or decision-maker name"), "Mere Owner"));
    await act(async () => setControlValue(control("Homeowner or decision-maker email"), "mere@example.co.nz"));
    await act(async () => setControlValue(control("Homeowner or decision-maker phone"), "021 555 0102"));
    await act(async () => setControlValue(control("Role"), "developer"));
    expect(document.body.textContent).not.toContain("Homeowner or decision-maker details");

    await act(async () => setControlValue(control("Role"), "builder"));
    expect((control("Homeowner or decision-maker name") as HTMLInputElement).value).toBe("");
    expect((control("Homeowner or decision-maker email") as HTMLInputElement).value).toBe("");
    expect((control("Homeowner or decision-maker phone") as HTMLInputElement).value).toBe("");

    await act(async () => setControlValue(control("Homeowner or decision-maker email"), "not-an-email"));
    await act(async () => {
      control("Homeowner or decision-maker email").focus();
      control("Homeowner or decision-maker email").blur();
    });
    expect(document.body.textContent).toContain("Enter a valid email address.");

    await act(async () => setControlValue(control("Role"), "homeowner"));
    expect(document.body.textContent).not.toContain("Homeowner or decision-maker details");
  });
});
