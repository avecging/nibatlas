import type { AboutContent, RichNode } from "./content";
const p = (text: string): RichNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const h = (text: string): RichNode => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const link = (text: string, href: string): RichNode => ({
  type: "text",
  text,
  marks: [{ type: "link", attrs: { href } }],
});
/** Existing copy, with founder-approved removal of fixture counts and stale claims. */
export const DEFAULT_ABOUT: AboutContent = {
  title: "About Nib Atlas",
  introduction:
    "Nib Atlas is a map of physical fountain pen shops, and a private record of the ones you have been to. It exists to answer one question: where can I go to experience this hobby?",
  body: {
    type: "doc",
    content: [
      h("What the catalogue is"),
      p(
        "Every entry in Nib Atlas is a real business, entered by hand from sources we can point to or reviewed by Nib Atlas. Each listing shows its available source history or editorial review date.",
      ),
      p(
        "Most are shops you can walk into. A few are makers or suppliers whose own sources do not confirm a public shopfront, and those pages say so rather than assuming one — a detour is too far to travel on an assumption.",
      ),
      p(
        "Where something is not confirmed, Nib Atlas leaves it out rather than guessing. A shop with no published opening hours shows no hours at all. That is deliberate: a blank is easier to plan around than a plausible invention.",
      ),
      p(
        "The catalogue is curated rather than exhaustive. It does not claim to list every fountain pen shop in a country, and it grows a shop at a time.",
      ),
      h("Explore the catalogue"),
      {
        type: "paragraph",
        content: [
          link("Explore the map", "/"),
          {
            type: "text",
            text: " to see the places currently listed. A listing does not imply complete coverage of its country or locality.",
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "If a shop you know is missing, " },
          link("tell us about it", "/suggest-shop"),
          {
            type: "text",
            text: ". If a detail here is wrong, the shop’s own page has a way to report it that carries the listing with it.",
          },
        ],
      },
      h("Stamps and your Passport"),
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Visiting a shop is the point. When you are there, Nib Atlas can keep the visit as a stamp: an ink impression for that shop, with the place and the date. Stamps gather into a Passport that is ",
          },
          link("private by default", "/privacy"),
          {
            type: "text",
            text: " — no public profile, no followers, no leaderboard.",
          },
        ],
      },
      p(
        "You can browse the map without sharing your location. Nib Atlas asks for location when you choose Near Me or check your location to collect a stamp. Raw coordinates are not stored.",
      ),
      h("What Nib Atlas is not"),
      p(
        "There are no star ratings, no review prose, and no ranked feed. Nib Atlas is not a shop, and it is not a catalogue of pens, inks, or paper — it is about the places, and whether one is worth the trip.",
      ),
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "More on what is stored and what is never stored: ",
          },
          link("Privacy", "/privacy"),
          { type: "text", text: "." },
        ],
      },
    ],
  },
  teamHeading: "Our team",
  thanksHeading: "With thanks",
  people: [],
  support: {
    enabled: false,
    heading: "Support Nib Atlas",
    description: "",
    buttonLabel: "Support Nib Atlas",
    url: "",
  },
};
