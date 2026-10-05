// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Field } from "../application-form";

describe("validated application field", () => {
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.querySelector("#root")!);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it("shows a field warning only after the user leaves an invalid input", async () => {
    await act(async () => root.render(
      <Field
        label="Mobile"
        value="021 CALL NOW"
        onChange={() => undefined}
        validationName="mobile"
      />,
    ));

    const input = document.querySelector("input")!;
    expect(document.body.textContent).not.toContain("Enter a valid NZ mobile or landline number.");

    await act(async () => {
      input.focus();
      input.blur();
    });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).toContain("Enter a valid NZ mobile or landline number.");
  });

  it("clears the warning when a blurred value becomes valid", async () => {
    const render = async (value: string) => {
      await act(async () => root.render(
        <Field label="Email" value={value} onChange={() => undefined} validationName="email" />,
      ));
    };
    await render("not-an-email");
    const input = document.querySelector("input")!;
    await act(async () => {
      input.focus();
      input.blur();
    });
    expect(input.getAttribute("aria-invalid")).toBe("true");

    await render("aroha@example.co.nz");

    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(document.body.textContent).not.toContain("Enter a valid email address.");
  });

  it("does not carry touched state into a different field reused at the same position", async () => {
    await act(async () => root.render(
      <Field label="Consent" value="bad<script>" onChange={() => undefined} validationName="buildingConsentNumber" />,
    ));
    const input = document.querySelector("input")!;
    await act(async () => {
      input.focus();
      input.blur();
    });
    expect(input.getAttribute("aria-invalid")).toBe("true");

    await act(async () => root.render(
      <Field label="Full name" value="" onChange={() => undefined} validationName="name" />,
    ));

    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(document.body.textContent).not.toContain("Enter your full name.");
  });
});
