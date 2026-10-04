import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { nextLocationTypes } from "@/modules/applications/location-types";

import { LocationAreaFields } from "../application-form";

describe("location area controls", () => {
  it("places the environment choice before the compact area multi-select", () => {
    const html = renderToStaticMarkup(
      <LocationAreaFields
        index={0}
        location={{ types: ["deck", "balcony"], environment: "internal", other: "" }}
        onChange={() => undefined}
        onToggle={() => undefined}
      />,
    );

    expect(html.indexOf("Is this area internal or external?")).toBeLessThan(html.indexOf("Area type"));
    expect(html).toContain("<details");
    expect(html).toContain("Deck, Balcony");
    expect(html.match(/type="checkbox"/g)).toHaveLength(8);
  });

  it("keeps Pool area exclusive and limits ordinary selections to three", () => {
    expect(nextLocationTypes(["deck", "balcony"], "pool-area")).toEqual(["pool-area"]);
    expect(nextLocationTypes(["pool-area"], "stair")).toEqual(["stair"]);
    expect(nextLocationTypes(["deck", "balcony", "stair"], "landing")).toEqual([
      "deck",
      "balcony",
      "stair",
    ]);
    expect(nextLocationTypes(["deck", "balcony"], "deck")).toEqual(["balcony"]);
  });
});
