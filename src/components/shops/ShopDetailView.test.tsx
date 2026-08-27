import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopDetailView } from "@/src/components/shops/ShopDetailView";
import { nearbyPenShops, type NearbyShop } from "@/src/domain/nearby-shops";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { findPrototypeShop, prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";
import { shopValueSpecimen } from "@/src/fixtures/shop-value-specimen";
import { seedReviewerMode, WithReviewerMode } from "@/src/test/reviewer";

/**
 * The shop page's information order, and what it is allowed to say.
 *
 * WP4's product objective is that the page answers whether a place is worth a
 * fountain-pen enthusiast's trip. These assertions are about the order that
 * question is answered in, and about the page never answering it with something
 * the record does not carry.
 *
 * Reviewer mode is seeded off throughout: what is under review here is the page
 * a normal tester receives. The reviewer-only islands decide for themselves and
 * have their own coverage in `tests/e2e/reviewer-mode.spec.ts`.
 */
function renderShop(shop: ShopDetail, nearby: readonly NearbyShop[] = []) {
  seedReviewerMode(false);

  return render(
    <WithReviewerMode>
      <ShopDetailView
        shop={shop}
        nearby={nearby}
        back={<span>Back to map</span>}
        statusBadges={<span>Unvisited</span>}
        actions={<button type="button">Save</button>}
      />
    </WithReviewerMode>,
  );
}

/** Headings in document order, which is the page's information order. */
function headingOrder(): readonly string[] {
  return screen
    .getAllByRole("heading")
    .map((heading) => heading.textContent?.trim() ?? "");
}

describe("shop page information order", () => {
  it("leads with the identity, then the shop's own name and why to visit", () => {
    const shop = findPrototypeShop("ginza-itoya-main-store")!;

    renderShop(shop);

    // The identity plate carries the page's only h1.
    const titles = screen.getAllByRole("heading", { level: 1 });

    expect(titles).toHaveLength(1);
    expect(titles[0]).toHaveTextContent("Ginza Itoya Main Store");

    // The local-script name sits directly under it, in its own language.
    const localName = screen.getByText("銀座 伊東屋 本店");

    expect(localName).toHaveAttribute("lang", "ja");
    expect(screen.getByText(/stationery specialist that has traded in Ginza/i)).toBeInTheDocument();
  });

  it("puts what you can do there before the practical detail and the actions", () => {
    renderShop(shopValueSpecimen, []);

    const order = headingOrder();

    expect(order).toEqual([
      "Specimen Pen Bench",
      "What you can do there",
      // Two labelled groups: something done to your pen, and something you do in
      // the shop.
      "Services",
      "In the shop",
      "Only available here",
      "Getting there",
      "Opening hours",
    ]);

    // The actions come after the practical information, and the provenance and
    // correction lines after them.
    const page = document.body.textContent ?? "";

    expect(page.indexOf("Getting there")).toBeLessThan(page.indexOf("Save"));
    expect(page.indexOf("Save")).toBeLessThan(page.indexOf("Found something wrong"));
  });

  it("keeps nearby pen shops after the actions, as trip context", () => {
    const aestheticBay = findPrototypeShop("aesthetic-bay")!;

    renderShop(aestheticBay, nearbyPenShops(aestheticBay, prototypeShopDetails));

    const order = headingOrder();

    expect(order[order.length - 1]).toBe("Nearby pen shops");

    const page = document.body.textContent ?? "";

    expect(page.indexOf("Save")).toBeLessThan(page.indexOf("Nearby pen shops"));
  });
});

describe("what you can do there", () => {
  it("states how a service is reached and how long it takes", () => {
    renderShop(shopValueSpecimen);

    const services = screen.getByRole("list", { name: "Services" });

    expect(within(services).getByText("Nib alignment & tuning")).toBeInTheDocument();
    expect(within(services).getByText("Walk-in · ~30 min")).toBeInTheDocument();
    expect(within(services).getByText("Booking · 3–5 days")).toBeInTheDocument();
    // A service with no sourced duration shows the mode alone rather than a
    // guess at how long it takes.
    expect(within(services).getByText("Send-in")).toBeInTheDocument();
  });

  it("shows in-store experiences and whether they need booking", () => {
    renderShop(shopValueSpecimen);

    const experiences = screen.getByRole("list", { name: "In-store experiences" });

    expect(within(experiences).getByText("Test bench")).toBeInTheDocument();
    expect(within(experiences).getByText("No booking needed")).toBeInTheDocument();
    expect(within(experiences).getByText("Booking needed")).toBeInTheDocument();
  });

  it("gives the only-available-here items their own section", () => {
    renderShop(shopValueSpecimen);

    const exclusives = screen.getByRole("list", { name: "Only available here" });

    expect(within(exclusives).getByText("House ink — Bench No.4")).toBeInTheDocument();
    expect(screen.queryByTestId("shop-value-gap")).not.toBeInTheDocument();
  });
});

describe("a material information gap", () => {
  const shop = findPrototypeShop("juspirit-banqiao")!;

  it("shows one concise caution and the contribution invitation", () => {
    renderShop(shop);

    const gap = screen.getByTestId("shop-value-gap");

    expect(gap).toHaveTextContent(/have not confirmed what you can do at this shop/i);

    const invitation = within(gap).getByRole("link", {
      name: "Know this shop? Help us improve this listing.",
    });

    expect(invitation).toHaveAttribute(
      "href",
      "mailto:hello@nibatlas.com?subject=%5BShop%20correction%5D%20Juspirit",
    );
  });

  it("does not list the fields that are missing, or apologise for them", () => {
    renderShop(shop);

    const gap = screen.getByTestId("shop-value-gap");
    const body = gap.textContent ?? "";

    expect(body).not.toMatch(/sorry|unfortunately|no data|not available yet/i);
    // One caution, not a section of empty rows.
    expect(within(gap).queryAllByRole("list")).toHaveLength(0);
  });

  it("omits ordinary unsupported fields in silence", () => {
    // Juspirit has an address from a community list and nothing else: no station,
    // no payment method, no language, and no invented placeholder for any of it.
    renderShop(shop);

    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(screen.queryByText("Nearest station")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment")).not.toBeInTheDocument();
    expect(screen.queryByText("Languages")).not.toBeInTheDocument();
    expect(screen.queryByText("Accessibility")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Only available here" })).not.toBeInTheDocument();
  });
});

describe("practical visit information", () => {
  it("names the station, the floor, the payment methods and the languages", () => {
    renderShop(shopValueSpecimen);

    const section = screen.getByRole("region", { name: "Getting there" });

    expect(within(section).getByText(/Specimen Station, exit B2 · 4 minutes on foot/)).toBeInTheDocument();
    expect(within(section).getByText(/Third floor of the Specimen Building/)).toBeInTheDocument();
    expect(within(section).getByText("Cash, Credit card")).toBeInTheDocument();
    expect(within(section).getByText("Japanese, English")).toBeInTheDocument();
    expect(within(section).getByText("Step-free from the lift lobby.")).toBeInTheDocument();
  });

  it("says nothing about an appointment that is not required", () => {
    renderShop(shopValueSpecimen);

    expect(screen.queryByText("Appointment")).not.toBeInTheDocument();
  });
});

describe("the interim identity treatment", () => {
  it("carries the Nib Atlas identity and one restrained photography note", () => {
    renderShop(findPrototypeShop("pen-house-tainan")!);

    expect(screen.getAllByText("Photos coming soon")).toHaveLength(1);
    // No photographs, and no empty gallery slots standing in for them.
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByText("Nib Atlas")).toBeInTheDocument();
  });
});

describe("nearby pen shops", () => {
  it("shows a distance only where both points came from a street address", () => {
    const aestheticBay = findPrototypeShop("aesthetic-bay")!;

    renderShop(aestheticBay, nearbyPenShops(aestheticBay, prototypeShopDetails));

    const section = screen.getByRole("region", { name: "Nearby pen shops" });

    expect(
      within(section).getByRole("link", { name: /Fook Hing Trading Co\./ }),
    ).toHaveAttribute("href", "/shops/fook-hing-trading");
    expect(within(section).getByText(/about \d+ m away/)).toBeInTheDocument();
    expect(within(section).getByText(/straight-line between approximate map points/i)).toBeInTheDocument();
  });

  it("says where an unmeasurable neighbour is instead of guessing a number", () => {
    const nagasawa = findPrototypeShop("nagasawa-stationery-center-main-store")!;

    renderShop(nagasawa, nearbyPenShops(nagasawa, prototypeShopDetails));

    const section = screen.getByRole("region", { name: "Nearby pen shops" });

    expect(within(section).getByText(/Also in Kobe/)).toBeInTheDocument();
    expect(within(section).queryByText(/away/)).not.toBeInTheDocument();
    expect(within(section).queryByText(/straight-line/i)).not.toBeInTheDocument();
  });

  it("renders no section at all when there is no neighbour in reach", () => {
    const skb = findPrototypeShop("skb-kaohsiung")!;

    renderShop(skb, nearbyPenShops(skb, prototypeShopDetails));

    expect(screen.queryByRole("heading", { name: "Nearby pen shops" })).not.toBeInTheDocument();
  });
});

describe("the correction route", () => {
  it("carries the shop's name in the subject, so a reply is actionable", () => {
    renderShop(findPrototypeShop("ty-lee-pen-shop")!);

    expect(
      screen.getByRole("link", { name: "Report incorrect information" }),
    ).toHaveAttribute(
      "href",
      "mailto:hello@nibatlas.com?subject=%5BShop%20correction%5D%20TY%20Lee%20Pen%20Shop",
    );
  });
});

describe("what the page never becomes", () => {
  it("has no rating, review, stock, or purchase surface", () => {
    for (const shop of [shopValueSpecimen, findPrototypeShop("pen-house-tainan")!]) {
      const { unmount } = renderShop(shop);
      const body = document.body.textContent ?? "";

      expect(body).not.toMatch(/rating|★|review|in stock|add to (bag|cart)|buy now|price/i);
      unmount();
    }
  });
});
