import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImpressionPlate } from "@/src/components/stamps/ImpressionPlate";
import { SEAL_DEVICE_PATHS, StampArt, STAMP_MOTIF_PATHS } from "@/src/components/stamps/StampArt";
import { PROTOTYPE_DESIGN_VERSION } from "@/src/fixtures/prototype-catalogue";
import type { ShopStampDesign, StampTier } from "@/src/domain/shop-detail";
import { STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";

/**
 * The impression family.
 *
 * WP5's rule is that the three artefacts share one material and differ by
 * anatomy, framing, typography and hierarchy — never by colour, because no ink
 * in this system is allowed to mean anything. These assertions are about that
 * rule, not about the drawing.
 */
function design(tier: StampTier, overrides: Partial<ShopStampDesign> = {}): ShopStampDesign {
  return {
    id: `stamp-${tier}`,
    tier,
    motif: "storefront",
    ink: "teal",
    localityLabel: "Chūō, Tokyo",
    countryLabel: "Japan",
    designVersion: PROTOTYPE_DESIGN_VERSION,
    paletteVersion: STAMP_PALETTE_VERSION,
    ...overrides,
  };
}

function svgFor(tier: StampTier, props: Partial<Parameters<typeof StampArt>[0]> = {}) {
  const { container } = render(
    <StampArt
      stamp={design(tier)}
      subtitle="2026-03-14"
      title={tier === "country" ? "Japan" : "Ginza Itoya Main Store"}
      {...props}
    />,
  );
  const svg = container.querySelector("svg");

  if (svg === null) {
    throw new Error("no impression rendered");
  }

  return svg;
}

function textContents(svg: SVGElement): string[] {
  return [...svg.querySelectorAll("text")].map((node) => node.textContent ?? "");
}

describe("one material", () => {
  it("draws every tier in the same box, so one plate fits them all", () => {
    for (const tier of ["shop", "locality", "country"] as const) {
      expect(svgFor(tier).getAttribute("viewBox")).toBe("0 0 600 400");
    }
  });

  it("takes its ink from the design and never from the tier", () => {
    for (const tier of ["shop", "locality", "country"] as const) {
      const { container } = render(
        <StampArt stamp={design(tier, { ink: "moss" })} title="Somewhere" />,
      );

      expect(container.querySelector("figure")).toHaveAttribute("data-ink", "moss");
      expect(container.querySelector("g[stroke]")).toHaveAttribute(
        "stroke",
        "var(--ink-moss)",
      );
    }
  });

  it("says which ink and which tier in its accessible description", () => {
    render(
      <StampArt
        stamp={design("shop", { ink: "plum" })}
        subtitle="2026-03-14"
        title="Ginza Itoya Main Store"
      />,
    );

    const description = screen.getByRole("img").getAttribute("aria-label") ?? "";

    expect(description).toContain("Shop stamp");
    expect(description).toContain("Ginza Itoya Main Store");
    expect(description).toContain("collected 2026-03-14");
    expect(description).toContain("Plum ink");
  });

  it("says so when nothing has been pressed yet", () => {
    render(<StampArt stamp={design("shop")} title="Ginza Itoya Main Store" />);

    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "not yet collected",
    );
  });
});

describe("three anatomies", () => {
  it("gives a shop stamp a rounded frame and its own motif", () => {
    const svg = svgFor("shop");
    const frames = [...svg.querySelectorAll("rect")];

    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute("rx", "34");
    expect(svg.innerHTML).toContain(STAMP_MOTIF_PATHS.storefront[0]);
  });

  it("gives a locality seal a cornered frame and a centred block", () => {
    const svg = svgFor("locality", { title: "Chūō, Tokyo" });

    // One square frame plus the corner ticks, and no rounding anywhere.
    expect(svg.querySelectorAll("rect")).toHaveLength(1);
    expect(svg.querySelector("rect")).not.toHaveAttribute("rx");
    expect(
      [...svg.querySelectorAll("text")].filter(
        (node) => node.getAttribute("text-anchor") === "middle",
      ).length,
    ).toBeGreaterThan(1);
    // Its own country, named above it.
    expect(textContents(svg)).toContain("JAPAN");
  });

  it("gives a country seal a double rule and the Nib Atlas device", () => {
    const svg = svgFor("country", { title: "Japan" });

    expect(svg.querySelectorAll("rect")).toHaveLength(2);
    expect(svg.innerHTML).toContain(SEAL_DEVICE_PATHS[0]);
    // Never a shop's motif: a country seal is derived, not pressed at a place.
    expect(svg.innerHTML).not.toContain(STAMP_MOTIF_PATHS.storefront[0]);
  });

  it("keeps the shop's place line off the seals, which name themselves", () => {
    expect(textContents(svgFor("shop"))).toContain("CHŪŌ, TOKYO · JAPAN");
    expect(textContents(svgFor("locality", { title: "Chūō, Tokyo" }))).not.toContain(
      "CHŪŌ, TOKYO · JAPAN",
    );
  });

  it("keeps the same foot on every tier", () => {
    for (const tier of ["shop", "locality", "country"] as const) {
      const contents = textContents(svgFor(tier));

      expect(contents).toContain("2026-03-14");
      expect(contents).toContain("NIB ATLAS");
    }
  });
});

describe("legible at the size it is given", () => {
  it("drops the lines a thumbnail cannot carry", () => {
    const contents = textContents(svgFor("shop", { detail: "compact" }));

    expect(contents).toContain("SHOP");
    expect(contents.join(" ")).toContain("Ginza Itoya");
    // The date, the provenance and the place line are stated in real text beside
    // the impression on every surface that uses the compact composition.
    expect(contents).not.toContain("2026-03-14");
    expect(contents).not.toContain("NIB ATLAS");
    expect(contents).not.toContain("CHŪŌ, TOKYO · JAPAN");
  });

  it("still says what it is, and still names itself", () => {
    const svg = svgFor("locality", { detail: "compact", title: "Naka, Yokohama" });

    expect(textContents(svg)).toContain("LOCALITY");
    expect(textContents(svg).join(" ")).toContain("Naka");
  });

  it("describes itself the same way at either size", () => {
    const full = svgFor("shop").getAttribute("aria-label");
    const compact = svgFor("shop", { detail: "compact" }).getAttribute("aria-label");

    expect(compact).toBe(full);
  });
});

describe("long names wrap rather than overrun", () => {
  it("splits a long shop name onto a second line", () => {
    const svg = svgFor("shop", {
      title: "NAGASAWA Stationery Center Main Store",
    });
    const nameLines = [...svg.querySelectorAll("text")].filter((node) =>
      node.getAttribute("x") === "42" && node.hasAttribute("font-size"),
    );

    expect(nameLines.length).toBeGreaterThan(1);
    expect(nameLines.map((node) => node.textContent).join(" ")).toBe(
      "NAGASAWA Stationery Center Main Store",
    );
  });

  it("keeps a long locality name inside its own frame", () => {
    const svg = svgFor("locality", { title: "East District, Tainan" });

    expect(textContents(svg).join(" ")).toContain("East District, Tainan");
  });
});

describe("the plate", () => {
  it("puts the impression on paper, and says whether it has been pressed", () => {
    const { container } = render(
      <ImpressionPlate size="detail">
        <StampArt stamp={design("shop")} subtitle="2026-03-14" title="Itoya" />
      </ImpressionPlate>,
    );
    const plate = container.querySelector("[data-plate-size]");

    expect(plate).toHaveAttribute("data-plate-size", "detail");
    expect(plate).toHaveAttribute("data-plate-state", "collected");
    expect(plate?.querySelector("[data-impression]")).toBeInTheDocument();
    expect(plate?.querySelector("svg")).toBeInTheDocument();
  });

  it("marks an unpressed sheet as such rather than hiding the artwork", () => {
    const { container } = render(
      <ImpressionPlate collected={false} size="thumb">
        <StampArt detail="compact" stamp={design("shop")} title="Itoya" />
      </ImpressionPlate>,
    );

    expect(container.querySelector("[data-plate-size]")).toHaveAttribute(
      "data-plate-state",
      "uncollected",
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
