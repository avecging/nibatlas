import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ShopDetailUnavailable } from "@/src/components/shops/ShopDetailUnavailable";
import {
  clearReviewerMode,
  seedReviewerMode,
  WithReviewerMode,
} from "@/src/test/reviewer";

describe("shop detail unavailable", () => {
  beforeEach(() => {
    clearReviewerMode();
  });

  function renderUnavailable(reviewer: boolean) {
    seedReviewerMode(reviewer);

    render(
      <WithReviewerMode>
        <ShopDetailUnavailable slug="contract-shop" reason="contract" />
      </WithReviewerMode>,
    );
  }

  /*
   * The page exists because a failed read is not a missing shop. It must say the
   * listing could not be loaded and state nothing else — a name, a locality, or
   * an operating status shown here would be a fact nothing backed.
   */
  it("states no catalogue fact and keeps a way back to the map", () => {
    renderUnavailable(false);

    expect(
      screen.getByRole("heading", { name: /this shop page is unavailable/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to map/i })).toHaveAttribute("href", "/");
    expect(screen.queryByTestId("shop-detail-unavailable-reason")).not.toBeInTheDocument();
  });

  it("names the failing layer for a reviewer only", () => {
    renderUnavailable(true);

    expect(screen.getByTestId("shop-detail-unavailable-reason")).toHaveTextContent(
      /v1 contract rejects/i,
    );
  });
});
