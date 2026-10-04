import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SystemReferenceCard } from "../application-form";

describe("SystemReferenceCard", () => {
  it("shows the selected system reference image and name", () => {
    const html = renderToStaticMarkup(<SystemReferenceCard system="side-channel" />);

    expect(html).toContain("Side Mount Channel");
    expect(html).toContain("%2Fassets%2Ffix-channel.jpg");
    expect(html).toContain("Representative prototype image");
  });

  it("does not show a product image for Not sure", () => {
    expect(renderToStaticMarkup(<SystemReferenceCard system="not-sure" />)).toBe("");
  });
});
