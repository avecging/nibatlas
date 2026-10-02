import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { aboutContent, aboutUrl, richDocument } from "./content";
import { DEFAULT_ABOUT } from "./default-content";
import { AboutView } from "./AboutView";
const copy = () => structuredClone(DEFAULT_ABOUT);
describe("About content and public rendering", () => {
  it("preserves supported structure, bold and safe links without HTML", () => {
    const d = copy();
    d.body = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "<img src=x onerror=alert(1)>",
              marks: [
                { type: "bold" },
                { type: "link", attrs: { href: "https://example.com" } },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Third" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(
      <AboutView content={aboutContent(d, true)} />,
    );
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("<strong>");
    expect(html).toContain('<ol start="3">');
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "//evil.test",
    "https://user:pass@host.test",
    "/\\evil.test",
    "https://host.test/\nx",
  ])("rejects unsafe destinations %s", (v) =>
    expect(() => aboutUrl(v)).toThrow(),
  );
  it("permits internal body links but requires external people/support destinations", () => {
    expect(aboutUrl("/privacy")).toBe("/privacy");
    expect(() => aboutUrl("/privacy", true)).toThrow();
  });
  it("rejects unsupported nodes, attributes, deep nesting and oversized content", () => {
    expect(() =>
      richDocument({
        type: "doc",
        content: [{ type: "image", attrs: { src: "x" } }],
      }),
    ).toThrow();
    expect(() =>
      richDocument({
        type: "doc",
        content: [{ type: "paragraph", attrs: { onclick: "alert(1)" } }],
      }),
    ).toThrow();
    let n: unknown = { type: "paragraph" };
    for (let i = 0; i < 10; i++)
      n = {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph" }, n] }],
      };
    expect(() => richDocument({ type: "doc", content: [n] })).toThrow();
    const d = copy();
    d.introduction = "a".repeat(2001);
    expect(() => aboutContent(d)).toThrow();
  });
  it("allows incomplete drafts and requires complete visible entries/support on publish", () => {
    const d = copy();
    d.people.push({
      id: crypto.randomUUID(),
      group: "team",
      name: "",
      description: "",
      url: "",
    });
    expect(() => aboutContent(d)).not.toThrow();
    expect(() => aboutContent(d, true)).toThrow();
    d.people = [];
    d.support.enabled = true;
    expect(() => aboutContent(d)).not.toThrow();
    expect(() => aboutContent(d, true)).toThrow();
    d.support.enabled = false;
    expect(() => aboutContent(d, true)).not.toThrow();
  });
  it("hides empty groups and disabled support, preserves ordered people and moved groups", () => {
    const d = copy();
    const empty = renderToStaticMarkup(<AboutView content={aboutContent(d)} />);
    expect(empty).not.toMatch(
      /Our team|With thanks|Support Nib Atlas|Today the catalogue holds/,
    );
    d.people = ["Beta", "Alpha"].map((name) => ({
      id: crypto.randomUUID(),
      group: "thanks",
      name,
      description: "Catalogue research",
      url: "",
    }));
    const html = renderToStaticMarkup(
      <AboutView content={aboutContent(d, true)} />,
    );
    expect(html).not.toContain("Our team");
    expect(html.indexOf("Beta")).toBeLessThan(html.indexOf("Alpha"));
  });
});
