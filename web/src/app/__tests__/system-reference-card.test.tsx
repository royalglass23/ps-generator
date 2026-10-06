import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getSystemReferenceImages, getSystemsForFamily, SystemReferenceCard } from "../application-form";

describe("SystemReferenceCard", () => {
  it("shows the application-specific system image and selected state", () => {
    const html = renderToStaticMarkup(<SystemReferenceCard system="side-channel" family="pool" selected onSelect={() => undefined} />);

    expect(html).toContain("Side Mount Channel");
    expect(html).toContain("side-mount-channel-pool-v1.png");
    expect(html).toContain("Selected");
  });

  it("shows both Juralco EDGE canopy references in one system card", () => {
    const html = renderToStaticMarkup(<SystemReferenceCard system="juralco-canopy" family="canopy" selected={false} onSelect={() => undefined} />);

    expect(html).toContain("juralco-canopy-residential-v1.png");
    expect(html).toContain("juralco-canopy-commercial-v1.png");
    expect(html).toContain("Aluminium slat");
    expect(html).toContain("Glass canopy");
  });

  it("filters systems by the selected application", () => {
    expect(getSystemsForFamily("aluminium")).toEqual(["unex-ascot", "viking-aluminium"]);
    expect(getSystemsForFamily("canopy")).toEqual(["juralco-canopy"]);
    expect(getSystemsForFamily("not_sure")).toEqual([]);
    expect(getSystemReferenceImages("double-disc", "balustrade")).toEqual([
      "/assets/systems/ai/double-disc-balustrade-v1.png",
    ]);
    expect(getSystemReferenceImages("double-disc", "pool")).toEqual([
      "/assets/systems/ai/double-disc-pool-v1.png",
    ]);
  });
});
