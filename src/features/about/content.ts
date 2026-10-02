/** About-only structured text. Neither storage nor rendering accepts arbitrary HTML. */
export type RichMark =
  | { type: "bold" }
  | { type: "link"; attrs: { href: string } };
export interface RichNode {
  type:
    | "doc"
    | "paragraph"
    | "heading"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "text"
    | "hardBreak"
    | "aboutImage";
  attrs?: {
    level?: number;
    start?: number;
    imageId?: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
  };
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
}
export interface AboutPerson {
  id: string;
  group: "team" | "thanks";
  name: string;
  description: string;
  url: string;
  linkedin?: string;
  instagram?: string;
}
export interface AboutContent {
  title: string;
  introduction: string;
  body: RichNode;
  teamHeading: string;
  thanksHeading: string;
  people: AboutPerson[];
  support: {
    enabled: boolean;
    heading: string;
    description: string;
    buttonLabel: string;
    url: string;
  };
}
export interface AboutState {
  revision: string | null;
  publishedRevision: string | null;
  publishedAt: string | null;
  draft: AboutContent;
}
export class AboutValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}
const invalid = (field: string, message = "Check this field."): never => {
  throw new AboutValidationError(field, message);
};
export function aboutObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("content", "Invalid About content.");
  return value as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  allowed: string[],
  field: string,
) {
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    invalid(field, "Unsupported content or formatting.");
}
function text(value: unknown, max: number, field: string): string {
  if (
    typeof value !== "string" ||
    [...value].length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  )
    invalid(field, `Use at most ${max} characters.`);
  return value as string;
}
export function aboutUrl(
  value: unknown,
  external = false,
  field = "link",
): string {
  const url = text(value, 2000, field).trim();
  if (!url) return "";
  if (/[\s\\]/u.test(url))
    invalid(field, "Use a valid https:// or http:// link.");
  if (!external && /^\/(?!\/)/u.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (
      !/^https?:\/\/([a-z0-9.-]+)(:[0-9]{1,5})?([/?#][^\s\\]*)?$/iu.test(url) ||
      !/^https?:$/u.test(parsed.protocol) ||
      !/^https?:\/\//iu.test(url) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    )
      throw Error();
  } catch {
    invalid(field, "Use a valid https:// or http:// link.");
  }
  return url;
}
export function richDocument(value: unknown): RichNode {
  let nodes = 0,
    characters = 0,
    images = 0;
  const walk = (value: unknown, parent: string, depth: number): RichNode => {
    if (++nodes > 2000 || depth > 8)
      invalid("body", "The body is too large or too deeply nested.");
    const n = aboutObject(value),
      type = n.type;
    keys(n, ["type", "attrs", "content", "text", "marks"], "body");
    const allowed =
      parent === "root"
        ? ["doc"]
        : ["paragraph", "heading", "bulletList", "orderedList"];
    if (parent === "doc") allowed.push("aboutImage");
    if (parent === "paragraph" || parent === "heading")
      allowed.splice(0, allowed.length, "text", "hardBreak");
    if (parent === "bulletList" || parent === "orderedList")
      allowed.splice(0, allowed.length, "listItem");
    if (parent === "listItem")
      allowed.splice(
        0,
        allowed.length,
        "paragraph",
        "bulletList",
        "orderedList",
      );
    if (typeof type !== "string" || !allowed.includes(type))
      invalid("body", "Unsupported body formatting.");
    const result: RichNode = { type: type as RichNode["type"] };
    if (type === "aboutImage") {
      if (
        ++images > 20 ||
        n.content !== undefined ||
        n.text !== undefined ||
        n.marks !== undefined
      )
        invalid("body", "Use at most 20 images.");
      const a = aboutObject(n.attrs);
      keys(a, ["imageId", "alt", "caption", "width", "height"], "body");
      if (
        typeof a.imageId !== "string" ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(a.imageId)
      )
        invalid("body", "Upload this image again.");
      for (const size of [a.width, a.height])
        if (
          !Number.isInteger(size) ||
          (size as number) < 1 ||
          (size as number) > 2048
        )
          invalid("body");
      result.attrs = {
        imageId: a.imageId as string,
        alt: text(a.alt, 500, "Image description"),
        caption: text(a.caption, 1000, "Image caption"),
        width: a.width as number,
        height: a.height as number,
      };
      if (!result.attrs.alt?.trim())
        invalid(
          "Image description",
          "Describe the image for people who cannot see it.",
        );
      return result;
    }
    if (type === "text") {
      result.text = text(n.text, 60000, "body");
      characters += [...result.text].length;
      if (
        !result.text ||
        characters > 60000 ||
        n.content !== undefined ||
        n.attrs !== undefined
      )
        invalid("body");
    } else if (n.text !== undefined) invalid("body");
    if (n.marks !== undefined) {
      if (type !== "text" || !Array.isArray(n.marks) || n.marks.length > 2)
        invalid("body");
      const seen = new Set<string>();
      result.marks = (n.marks as unknown[]).map((value) => {
        const m = aboutObject(value);
        keys(m, ["type", "attrs"], "body");
        if (typeof m.type !== "string" || seen.has(m.type)) invalid("body");
        seen.add(m.type as string);
        if (m.type === "bold" && m.attrs === undefined) return { type: "bold" };
        if (m.type !== "link") invalid("body");
        const attrs = aboutObject(m.attrs);
        // Tiptap's presentation defaults are discarded; only the destination is stored.
        keys(attrs, ["href", "target", "rel", "class", "title"], "body");
        const href = aboutUrl(attrs.href, false, "body");
        if (!href) invalid("body", "Links need a destination.");
        return { type: "link", attrs: { href } };
      });
    }
    if (n.attrs !== undefined) {
      const a = aboutObject(n.attrs);
      keys(
        a,
        type === "heading"
          ? ["level"]
          : type === "orderedList"
            ? ["start", "type"]
            : [],
        "body",
      );
      if (type === "heading") {
        if (a.level !== 2 && a.level !== 3) invalid("body");
        result.attrs = { level: a.level as number };
      } else if (type === "orderedList") {
        if (
          !Number.isInteger(a.start) ||
          (a.start as number) < 1 ||
          (a.start as number) > 999
        )
          invalid("body");
        result.attrs = { start: a.start as number };
      }
    } else if (type === "heading") invalid("body");
    if (!["text", "hardBreak"].includes(type as string)) {
      if (n.content !== undefined && !Array.isArray(n.content)) invalid("body");
      result.content = ((n.content ?? []) as unknown[]).map((child) =>
        walk(child, type as string, depth + 1),
      );
      if (
        (type === "doc" ||
          type === "listItem" ||
          type === "bulletList" ||
          type === "orderedList") &&
        !result.content.length
      )
        invalid("body");
      if (type === "listItem" && result.content[0]?.type !== "paragraph")
        invalid("body");
    } else if (n.content !== undefined) invalid("body");
    return result;
  };
  return walk(value, "root", 0);
}
export function aboutContent(value: unknown, publish = false): AboutContent {
  const d = aboutObject(value);
  keys(
    d,
    [
      "title",
      "introduction",
      "body",
      "teamHeading",
      "thanksHeading",
      "people",
      "support",
    ],
    "content",
  );
  if (!Array.isArray(d.people) || d.people.length > 100)
    invalid("people", "Use at most 100 people.");
  const ids = new Set<string>();
  const people = (d.people as unknown[]).map((value, i): AboutPerson => {
    const p = aboutObject(value),
      field = `people.${i}`;
    keys(
      p,
      ["id", "group", "name", "description", "url", "linkedin", "instagram"],
      field,
    );
    if (
      typeof p.id !== "string" ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(p.id) ||
      ids.has(p.id.toLowerCase()) ||
      !["team", "thanks"].includes(String(p.group))
    )
      invalid(field);
    ids.add((p.id as string).toLowerCase());
    return {
      id: p.id as string,
      group: p.group as AboutPerson["group"],
      name: text(p.name, 120, `${field}.name`),
      description: text(p.description, 500, `${field}.description`),
      url: aboutUrl(p.url, true, `${field}.url`),
      ...(p.linkedin !== undefined
        ? {
            linkedin: aboutSocialUrl(
              p.linkedin,
              "linkedin",
              `${field}.linkedin`,
            ),
          }
        : {}),
      ...(p.instagram !== undefined
        ? {
            instagram: aboutSocialUrl(
              p.instagram,
              "instagram",
              `${field}.instagram`,
            ),
          }
        : {}),
    };
  });
  const s = aboutObject(d.support);
  keys(
    s,
    ["enabled", "heading", "description", "buttonLabel", "url"],
    "support",
  );
  if (typeof s.enabled !== "boolean") invalid("support");
  const result: AboutContent = {
    title: text(d.title, 160, "title"),
    introduction: text(d.introduction, 2000, "introduction"),
    body: richDocument(d.body),
    teamHeading: text(d.teamHeading, 120, "teamHeading"),
    thanksHeading: text(d.thanksHeading, 120, "thanksHeading"),
    people,
    support: {
      enabled: s.enabled as boolean,
      heading: text(s.heading, 120, "support.heading"),
      description: text(s.description, 600, "support.description"),
      buttonLabel: text(s.buttonLabel, 80, "support.buttonLabel"),
      url: aboutUrl(s.url, true, "support.url"),
    },
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 100000)
    invalid("content", "The About page is too large.");
  if (publish) {
    const required = (v: string, field: string) => {
      if (!v.trim()) invalid(field, "Complete this field before publishing.");
    };
    required(result.title, "title");
    people.forEach((p, i) => {
      required(p.name, `people.${i}.name`);
      required(p.description, `people.${i}.description`);
      required(
        p.group === "team" ? result.teamHeading : result.thanksHeading,
        p.group === "team" ? "teamHeading" : "thanksHeading",
      );
    });
    if (result.support.enabled)
      for (const k of ["heading", "description", "buttonLabel", "url"] as const)
        required(result.support[k], `support.${k}`);
  }
  return result;
}
const revision = (v: unknown): string | null => {
  if (v === null) return null;
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(v)
  )
    throw Error("Invalid revision");
  return v;
};
export function aboutState(value: unknown): AboutState {
  const d = aboutObject(value);
  if (
    d.publishedAt !== null &&
    (typeof d.publishedAt !== "string" ||
      !Number.isFinite(Date.parse(d.publishedAt)))
  )
    throw Error("Invalid date");
  return {
    revision: revision(d.revision),
    publishedRevision: revision(d.publishedRevision),
    publishedAt: d.publishedAt as string | null,
    draft: aboutContent(d.draft),
  };
}

export function aboutSocialUrl(
  value: unknown,
  platform: "linkedin" | "instagram",
  field: string = platform,
): string {
  const url = aboutUrl(value, true, field);
  if (!url) return "";
  const host = new URL(url).hostname.toLowerCase();
  if (host !== `${platform}.com` && !host.endsWith(`.${platform}.com`))
    invalid(
      field,
      `Use a ${platform === "linkedin" ? "LinkedIn" : "Instagram"} URL.`,
    );
  return url;
}
export function aboutImageUrl(id: string, preview = false) {
  return `/api/v1/${preview ? "admin/" : ""}about/images/${id}`;
}
