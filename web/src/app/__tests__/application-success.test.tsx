import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ApplicationSuccess } from "../application-form";

describe("ApplicationSuccess", () => {
  it("confirms the application reference and email destination", () => {
    const html = renderToStaticMarkup(
      <ApplicationSuccess
        reference="PS1-2026-ABC12345"
        email="jordan@example.test"
      />,
    );

    expect(html).toContain("PS1-2026-ABC12345");
    expect(html).toContain("A confirmation email will be sent to");
    expect(html).toContain("jordan@example.test");
    expect(html).toContain("Check your junk folder");
    expect(html).toContain('href="/"');
    expect(html).toContain("Back to homepage");
  });
});
