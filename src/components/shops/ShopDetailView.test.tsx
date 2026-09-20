import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShopDetailView } from "@/src/components/shops/ShopDetailView";
import { ShopWhatYouCanDo } from "@/src/components/shops/ShopValueSections";
import { nearbyPenShops, type NearbyShop } from "@/src/domain/nearby-shops";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { findPrototypeShop, prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";
import { shopValueSpecimen } from "@/src/fixtures/shop-value-specimen";
import { seedReviewerMode, WithReviewerMode } from "@/src/test/reviewer";

afterEach(() => vi.unstubAllEnvs());

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
        save={<button type="button">Save shop</button>}
        back={<span>Back to map</span>}
        statusBadges={<span>Unvisited</span>}
        actions={<button type="button">Collect Stamp</button>}
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
  it.each(["API", "API-DEMO", " api "])("does not promise fixture photos in %s mode", (mode) => {
    vi.stubEnv("NEXT_PUBLIC_CATALOGUE_MODE", mode);
    renderShop(findPrototypeShop("ginza-itoya-main-store")!);
    expect(screen.queryByText("Photos coming soon")).not.toBeInTheDocument();
  });

  it("keeps practical-only editorial in one column even with hidden legacy services", () => {
    const { container } = renderShop({
      ...shopValueSpecimen,
      brands: [],
      exclusives: [],
      editorial: { nearest_station: "Example Station" },
    });
    expect(screen.getByText("Example Station", { exact: false })).toBeVisible();
    expect(screen.queryByTestId("shop-value-gap")).not.toBeInTheDocument();
    expect(container.querySelector('[data-columns="two"]')).toBeNull();
    expect(container.querySelector('[data-columns="one"]')).not.toBeNull();
  });

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

  it("puts the actions in the header, before the shop's own sections", () => {
    renderShop(shopValueSpecimen, []);

    const order = headingOrder();

    /*
     * WP4's own *What you can do there* is not here: the founder's
     * 20 September decision gives that question one heading, answered by
     * published editorial. The specimen still carries the services and
     * experiences behind it — see the component's own tests below.
     */
    expect(order).toEqual([
      "Specimen Pen Bench",
      "Only available here",
      "Plan your visit",
      "Getting there",
      "Before you go",
    ]);

    /*
     * The founder's staging review moved the actions back up: deciding whether
     * to go and being able to act on it belong together. Save is beside the
     * name, then the rest of the header, then the actions — all of it above the
     * sections.
     */
    const page = document.body.textContent ?? "";

    expect(page.indexOf("Save shop")).toBeLessThan(page.indexOf("Collect Stamp"));
    expect(page.indexOf("Collect Stamp")).toBeLessThan(
      page.indexOf("Only available here"),
    );
    expect(page.indexOf("Collect Stamp")).toBeLessThan(page.indexOf("Plan your visit"));
  });

  it("keeps nearby pen shops inside Getting there", () => {
    const aestheticBay = findPrototypeShop("aesthetic-bay")!;

    renderShop(aestheticBay, nearbyPenShops(aestheticBay, prototypeShopDetails));

    const order = headingOrder();

    // Inside the section, between its two subsections — not a section of its own
    // at the foot of the page.
    const plan = order.indexOf("Plan your visit");

    expect(order.slice(plan, plan + 4)).toEqual([
      "Plan your visit",
      "Getting there",
      "Nearby pen shops",
      "Before you go",
    ]);
  });
});

describe("what you can do", () => {
  /*
   * The legacy section came off the public page on 20 September; it was not
   * deleted. These are its own tests, against the component the styleguide
   * still renders, so the access modes, durations and booking qualifiers stay
   * covered by something other than the page that stopped showing them.
   */
  it("states how a service is reached and how long it takes", () => {
    render(<ShopWhatYouCanDo shop={shopValueSpecimen} />);

    const services = screen.getByRole("list", { name: "Services" });

    expect(within(services).getByText("Nib alignment & tuning")).toBeInTheDocument();
    expect(within(services).getByText("Walk-in · ~30 min")).toBeInTheDocument();
    expect(within(services).getByText("Booking · 3–5 days")).toBeInTheDocument();
    // A service with no sourced duration shows the mode alone rather than a
    // guess at how long it takes.
    expect(within(services).getByText("Send-in")).toBeInTheDocument();
  });

  it("shows in-store experiences and whether they need booking", () => {
    render(<ShopWhatYouCanDo shop={shopValueSpecimen} />);

    const experiences = screen.getByRole("list", { name: "In-store experiences" });

    expect(within(experiences).getByText("Test bench")).toBeInTheDocument();
    expect(within(experiences).getByText("No booking needed")).toBeInTheDocument();
    expect(within(experiences).getByText("Booking needed")).toBeInTheDocument();
  });

  it("does not answer the same question twice on the public page", () => {
    // The specimen carries three services and two experiences, and the page
    // shows neither: one heading, answered by published editorial.
    renderShop(shopValueSpecimen);

    expect(screen.queryByRole("list", { name: "Services" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "In-store experiences" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("What you can do there")).not.toBeInTheDocument();

    // And it does not claim nothing was confirmed when something was.
    expect(screen.queryByTestId("shop-value-gap")).not.toBeInTheDocument();
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

    // The invitation opens the same correction form the page foot does, and
    // the listing is in the path — nobody is asked which shop they mean.
    expect(invitation).toHaveAttribute("href", "/shops/juspirit-banqiao/report");
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
    expect(screen.getByRole("heading", { name: "Getting there" })).toBeInTheDocument();
    expect(screen.queryByText("Nearest station")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment")).not.toBeInTheDocument();
    expect(screen.queryByText("Languages")).not.toBeInTheDocument();
    expect(screen.queryByText("Accessibility")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Only available here" })).not.toBeInTheDocument();
  });
});

describe("Plan your visit", () => {
  it("splits getting there from what to know before you go", () => {
    renderShop(shopValueSpecimen);

    const section = screen.getByRole("region", { name: "Plan your visit" });

    expect(within(section).getByText(/Specimen Station, exit B2 · 4 minutes on foot/)).toBeInTheDocument();
    expect(within(section).getByText(/Third floor of the Specimen Building/)).toBeInTheDocument();
    expect(within(section).getByText("Cash, Credit card")).toBeInTheDocument();
    expect(within(section).getByText("Japanese, English")).toBeInTheDocument();
    expect(within(section).getByText("Step-free from the lift lobby.")).toBeInTheDocument();
  });

  it("carries the official website as a contextual link, and only once", () => {
    renderShop(findPrototypeShop("ginza-itoya-main-store")!);

    // Not a second header button: one labelled link, inside Before you go.
    expect(screen.getAllByRole("link", { name: "ito-ya.co.jp" })).toHaveLength(1);
    expect(screen.getByText("Official website")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^official site$/i })).not.toBeInTheDocument();
  });

  it("renders no heading over a subsection with nothing in it", () => {
    // SKB has a link and unpublished hours, and no address, station, floor note
    // or catalogue neighbour in reach.
    const sparse = findPrototypeShop("skb-kaohsiung")!;

    renderShop(sparse, []);

    expect(screen.getByRole("heading", { name: "Plan your visit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Before you go" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Getting there" })).not.toBeInTheDocument();
  });

  it("says nothing about an appointment that is not required", () => {
    renderShop(shopValueSpecimen);

    expect(screen.queryByText("Appointment")).not.toBeInTheDocument();
  });
});

describe("the identity header", () => {
  it("is text-led, with one restrained photography note and no decorative plate", () => {
    renderShop(findPrototypeShop("pen-house-tainan")!);

    // A fixture build has no media route to ask, so the caption accepted
    // decision 5 introduced is still the truthful answer.
    expect(screen.getAllByText("Photos coming soon")).toHaveLength(1);
    // No photographs, no empty gallery slots standing in for them, and no
    // reserved square where a logo would go.
    expect(document.querySelectorAll("img")).toHaveLength(0);

    // The stamp motif plate is gone from discovery: the impression belongs to
    // collection and the Passport. The collection action itself is untouched.
    expect(document.querySelectorAll("svg[viewBox='0 0 120 120']")).toHaveLength(0);
    expect(screen.getByText("Collect Stamp")).toBeInTheDocument();
  });

  it("puts the locality, both names and the shop type above the photographs", () => {
    renderShop(findPrototypeShop("ginza-itoya-main-store")!);

    const page = document.body.textContent ?? "";

    expect(page.indexOf("Chūō, Tokyo")).toBeLessThan(page.indexOf("Ginza Itoya Main Store"));
    expect(page.indexOf("銀座 伊東屋 本店")).toBeLessThan(page.indexOf("Stationery Store"));
    expect(page.indexOf("Stationery Store")).toBeLessThan(page.indexOf("Collect Stamp"));
  });
});

describe("nearby pen shops", () => {
  it("shows a distance only where both points came from a street address", () => {
    const aestheticBay = findPrototypeShop("aesthetic-bay")!;

    renderShop(aestheticBay, nearbyPenShops(aestheticBay, prototypeShopDetails));

    const list = screen.getByRole("list", { name: "Nearby pen shops" });

    expect(
      within(list).getByRole("link", { name: /Fook Hing Trading Co\./ }),
    ).toHaveAttribute("href", "/shops/fook-hing-trading");
    expect(within(list).getByText(/Approx\. \d+ m away/)).toBeInTheDocument();

    // `Approx.` carries the qualification; the separate straight-line paragraph
    // the founder's staging review found heavier than the fact is gone.
    expect(screen.queryByText(/straight-line/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approximate map points/i)).not.toBeInTheDocument();
  });

  it("says where an unmeasurable neighbour is instead of guessing a number", () => {
    const nagasawa = findPrototypeShop("nagasawa-stationery-center-main-store")!;

    renderShop(nagasawa, nearbyPenShops(nagasawa, prototypeShopDetails));

    const list = screen.getByRole("list", { name: "Nearby pen shops" });

    expect(within(list).getByText(/Also in Kobe/)).toBeInTheDocument();
    expect(within(list).queryByText(/away/)).not.toBeInTheDocument();
  });

  it("renders no subsection at all when there is no neighbour in reach", () => {
    const skb = findPrototypeShop("skb-kaohsiung")!;

    renderShop(skb, nearbyPenShops(skb, prototypeShopDetails));

    expect(screen.queryByRole("heading", { name: "Nearby pen shops" })).not.toBeInTheDocument();
  });
});

describe("the correction route", () => {
  it("carries the listing, so nobody has to identify it", () => {
    renderShop(findPrototypeShop("ty-lee-pen-shop")!);

    expect(
      screen.getByRole("link", { name: "Report incorrect information" }),
    ).toHaveAttribute("href", "/shops/ty-lee-pen-shop/report");
  });

  it("routes every catalogue shop to its own correction form", () => {
    for (const shop of prototypeShopDetails) {
      const { unmount } = renderShop(shop);

      expect(
        screen.getByRole("link", { name: "Report incorrect information" }),
      ).toHaveAttribute("href", `/shops/${shop.slug}/report`);

      unmount();
    }
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
