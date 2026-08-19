import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResultsSheet } from "@/src/components/map/ResultsSheet";

function renderSheet(state: "peek" | "half" | "full" = "peek") {
  const onStateChange = vi.fn();

  render(
    <ResultsSheet state={state} onStateChange={onStateChange} summary={<span>3 shops</span>}>
      <p>Results</p>
    </ResultsSheet>,
  );

  return { onStateChange };
}

describe("ResultsSheet", () => {
  it("exposes its current state to assistive technology", () => {
    renderSheet("half");

    expect(screen.getByRole("button", { name: /results sheet, half/i })).toBeInTheDocument();
    expect(screen.getByTestId("results-sheet")).toHaveAttribute("data-state", "half");
  });

  it("steps up through the three states on activation", () => {
    const { onStateChange } = renderSheet("peek");

    fireEvent.click(screen.getByRole("button", { name: /results sheet/i }));

    expect(onStateChange).toHaveBeenCalledWith("half");
  });

  it("steps back down from the full state", () => {
    const { onStateChange } = renderSheet("full");

    fireEvent.click(screen.getByRole("button", { name: /results sheet/i }));

    expect(onStateChange).toHaveBeenCalledWith("half");
  });

  it("resizes with the keyboard", () => {
    const { onStateChange } = renderSheet("peek");
    const handle = screen.getByRole("button", { name: /results sheet/i });

    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onStateChange).toHaveBeenCalledWith("half");

    onStateChange.mockClear();
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(onStateChange).not.toHaveBeenCalled();
  });
});
