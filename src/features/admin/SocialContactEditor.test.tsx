import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SocialContactEditor } from "./SocialContactEditor";
import type { Row } from "./shop-contract";

describe("social and contact editor", () => {
  it("adds selected platform fields, prevents a second account, and removes rows", () => {
    let links: Row[] = [];
    const onChange = vi.fn((next: Row[]) => { links = next; });
    const view = () => render(<SocialContactEditor links={links} disabled={false} onChange={onChange} />);
    const rendered = view();
    const socialAdd = screen.getAllByRole("button", { name: "Add" })[0]!;
    fireEvent.click(socialAdd);
    const dialog = screen.getByRole("dialog", { name: "Add social media" });
    expect(document.activeElement).toBe(within(dialog).getByText("Facebook").closest("label")!.querySelector("input"));
    fireEvent.click(within(dialog).getByText("Instagram").closest("label")!.querySelector("input")!);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ link_type: "social_instagram", label: null });

    rendered.rerender(<SocialContactEditor links={links} disabled={false} onChange={onChange} />);
    fireEvent.click(socialAdd);
    expect(within(screen.getByRole("dialog")).getByText(/Instagram/).closest("label")!.querySelector("input")!).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(socialAdd);
    fireEvent.click(screen.getByRole("button", { name: "Remove Instagram" }));
    expect(links).toEqual([]);
  });
});
