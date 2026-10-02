import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  aboutContent,
  aboutUrl,
  aboutSocialUrl,
  richDocument,
} from "./content";
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

it("validates social hosts and renders accessible icons in website/LinkedIn/Instagram order", () => {
  expect(() =>
    aboutSocialUrl("https://linkedin.com.evil.test/me", "linkedin"),
  ).toThrow();
  expect(() => aboutSocialUrl("javascript:alert(1)", "instagram")).toThrow();
  const d = copy();
  d.people = [
    {
      id: crypto.randomUUID(),
      group: "team",
      name: "A long contributor name",
      description: "Research",
      url: "https://example.com",
      linkedin: "https://www.linkedin.com/in/test",
      instagram: "https://instagram.com/test",
    },
  ];
  const html = renderToStaticMarkup(<AboutView content={aboutContent(d)} />);
  expect(html.indexOf("— Website")).toBeLessThan(html.indexOf("— LinkedIn"));
  expect(html.indexOf("— LinkedIn")).toBeLessThan(html.indexOf("— Instagram"));
  expect(html).toContain("<h3");
});
it("keeps body images constrained and uses private endpoints only in admin preview", () => {
  const d = copy();
  const id = crypto.randomUUID();
  d.body = {
    type: "doc",
    content: [
      {
        type: "aboutImage",
        attrs: {
          imageId: id,
          alt: "A pen shop",
          caption: "<script>caption</script>",
          width: 2,
          height: 2,
        },
      },
    ],
  };
  const valid = aboutContent(d, true);
  const publicHtml = renderToStaticMarkup(<AboutView content={valid} />),
    privateHtml = renderToStaticMarkup(<AboutView content={valid} preview />);
  expect(publicHtml).toContain(`/api/v1/about/images/${id}`);
  expect(publicHtml).not.toContain("/admin/");
  expect(privateHtml).toContain(`/api/v1/admin/about/images/${id}`);
  expect(publicHtml).toContain("&lt;script&gt;");
  expect(() =>
    richDocument({
      type: "doc",
      content: [
        {
          type: "aboutImage",
          attrs: { ...d.body.content![0]!.attrs, src: "https://evil.test/x" },
        },
      ],
    }),
  ).toThrow();
  expect(() =>
    richDocument({
      type: "doc",
      content: [{ type: "paragraph", content: d.body.content }],
    }),
  ).toThrow();
  expect(() =>
    richDocument({ type: "doc", content: Array(21).fill(d.body.content![0]) }),
  ).toThrow();
});
