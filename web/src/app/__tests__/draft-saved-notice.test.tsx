import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DraftSavedNotice } from "../draft-saved-notice";

describe("DraftSavedNotice", () => {
  it("shows the resume link and confirms which email received it", () => {
    const resumeUrl = "https://ps1.example.test/application/draft-1#token=resume-secret";
    const html = renderToStaticMarkup(
      <DraftSavedNotice resumeUrl={resumeUrl} email="jordan@example.test" />,
    );

    expect(html).toContain(`href="${resumeUrl}"`);
    expect(html).toContain(resumeUrl);
    expect(html).toContain("jordan@example.test");
    expect(html).toContain("expires after 24 hours");
  });
});
