export const SOCIAL_PLATFORMS = [
  { key: "facebook", label: "Facebook", mark: "f" },
  { key: "instagram", label: "Instagram", mark: "◎" },
  { key: "tiktok", label: "TikTok", mark: "♪" },
  { key: "xiaohongshu", label: "Xiaohongshu", mark: "小红书" },
  { key: "threads", label: "Threads", mark: "@" },
  { key: "x", label: "X", mark: "X" },
  { key: "youtube", label: "YouTube", mark: "▶" },
] as const;

export const CONTACT_PLATFORMS = [
  { key: "whatsapp", label: "WhatsApp", mark: "☎" },
  { key: "telegram", label: "Telegram", mark: "➤" },
  { key: "line", label: "LINE", mark: "LINE" },
  { key: "wechat", label: "WeChat", mark: "微" },
  { key: "messenger", label: "Messenger", mark: "ϟ" },
  { key: "kakaotalk", label: "KakaoTalk", mark: "T" },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["key"];
export type ContactPlatform = (typeof CONTACT_PLATFORMS)[number]["key"];
export type ChannelPlatform = SocialPlatform | ContactPlatform;
export type ChannelKind = "social" | "contact";
export type ChannelLinkType = `social_${SocialPlatform}` | `contact_${ContactPlatform}`;

export function channelLinkType(kind: ChannelKind, platform: ChannelPlatform): ChannelLinkType {
  return `${kind}_${platform}` as ChannelLinkType;
}

export function parseChannelLinkType(value: string): { kind: ChannelKind; platform: ChannelPlatform } | undefined {
  const match = /^(social|contact)_(.+)$/.exec(value);
  if (!match) return undefined;
  const kind = match[1] as ChannelKind;
  const platform = platformFor(kind, match[2]!);
  return platform ? { kind, platform: platform.key as ChannelPlatform } : undefined;
}

export function platformFor(kind: ChannelKind, key: string) {
  return (kind === "social" ? SOCIAL_PLATFORMS : CONTACT_PLATFORMS).find((item) => item.key === key);
}

export function channelKind(key: string): ChannelKind | undefined {
  return parseChannelLinkType(key)?.kind;
}

export function isChannelLink(value: { link_type?: unknown }): value is { link_type: ChannelLinkType } {
  return typeof value.link_type === "string" && parseChannelLinkType(value.link_type) !== undefined;
}

export function normalizeChannelValue(
  kind: ChannelKind,
  platform: ChannelPlatform,
  input: string,
): { value: string; url: string | null } {
  const value = input.trim();
  if (!value || value.length > 4000) throw new Error("Enter a link, handle or contact value of up to 4,000 characters.");

  if (kind === "social") {
    if (!isSocialPlatform(platform)) throw new Error("Choose a social platform.");
    const suppliedUrl = webUrl(value);
    if (suppliedUrl) return { value, url: suppliedUrl };
    let handle = value.replace(/^@/, "");
    if (platform === "youtube") handle = value.startsWith("@") ? value.slice(1) : value;
    if (!/^[\p{L}\p{N}._-]{1,150}$/u.test(handle)) {
      throw new Error("Enter a complete web link or a platform handle.");
    }
    if (platform === "xiaohongshu" && !/^[a-f\d]{24}$/i.test(handle)) {
      throw new Error("For Xiaohongshu, enter the account ID or paste its profile/share link.");
    }
    if (platform === "youtube" && !value.startsWith("@")) {
      throw new Error("For YouTube, enter a handle beginning with @ or paste the channel link.");
    }
    const encoded = encodeURIComponent(handle);
    const paths: Record<SocialPlatform, string> = {
      facebook: `https://www.facebook.com/${encoded}`,
      instagram: `https://www.instagram.com/${encoded}/`,
      tiktok: `https://www.tiktok.com/@${encoded}`,
      xiaohongshu: `https://www.xiaohongshu.com/user/profile/${encoded}`,
      threads: `https://www.threads.net/@${encoded}`,
      x: `https://x.com/${encoded}`,
      youtube: `https://www.youtube.com/@${encoded}`,
    };
    return { value, url: paths[platform] };
  }

  if (!isContactPlatform(platform)) throw new Error("Choose a contact platform.");
  const suppliedUrl = webUrl(value);
  if (suppliedUrl) {
    const extracted = extractContactValue(platform, suppliedUrl);
    // A short/share link is useful as a copied link, but its token is never
    // mislabeled as a person's account ID or treated as a launch destination.
    return extracted
      ? { value: extracted, url: suppliedUrl }
      : { value: suppliedUrl, url: null };
  }

  const bare = value.replace(/^@/, "");
  if (!/^[\p{L}\p{N}._+@() -]{1,250}$/u.test(value)) {
    throw new Error("Enter a phone number, ID or complete web link.");
  }
  const mobile = contactUrlFromValue(platform, platform === "line" ? value : bare);
  return { value, url: mobile };
}

function isSocialPlatform(platform: ChannelPlatform): platform is SocialPlatform {
  return SOCIAL_PLATFORMS.some((item) => item.key === platform);
}

function isContactPlatform(platform: ChannelPlatform): platform is ContactPlatform {
  return CONTACT_PLATFORMS.some((item) => item.key === platform);
}

export function contactCopyLabel(value: string): string {
  return /^https?:\/\//i.test(value) ? "Link copied" : "Copied";
}

export function contactMobileUrl(platform: ContactPlatform, value: string, url?: string): string | undefined {
  if (url) return url;
  return contactUrlFromValue(platform, platform === "line" ? value : value.replace(/^@/, "")) ?? undefined;
}

function webUrl(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password || !["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractContactValue(platform: ContactPlatform, value: string): string | null {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (platform === "whatsapp" && (host === "wa.me" || host.endsWith("whatsapp.com"))) {
    const phone = parts[0]?.replace(/\D/g, "") ?? "";
    return phone.length >= 8 && phone.length <= 15 ? phone : null;
  }
  if (platform === "telegram" && ["t.me", "telegram.me"].includes(host)) {
    const name = parts[0] ?? "";
    return /^[A-Za-z0-9_]{5,32}$/.test(name) ? `@${name}` : null;
  }
  if (platform === "line" && host === "line.me" && parts[0]?.toLowerCase() === "r" && parts[1]?.toLowerCase() === "ti" && parts[2]?.toLowerCase() === "p") {
    const id = parts[3] ?? "";
    return id.length > 0 && id.length <= 100 ? id : null;
  }
  if (platform === "messenger" && host === "m.me") {
    const id = parts[0] ?? "";
    return /^[A-Za-z0-9.]{1,100}$/.test(id) ? id : null;
  }
  return null;
}

function contactUrlFromValue(platform: ContactPlatform, input: string): string | null {
  if (platform === "whatsapp") {
    const digits = input.replace(/\D/g, "");
    // wa.me requires a full international number. Never infer a country code.
    return input.startsWith("+") && digits.length >= 8 && digits.length <= 15
      ? `https://wa.me/${digits}`
      : null;
  }
  if (platform === "telegram") {
    const username = input.replace(/^@/, "");
    return /^[A-Za-z0-9_]{5,32}$/.test(username) ? `https://t.me/${username}` : null;
  }
  if (platform === "line") {
    return /^@[\p{L}\p{N}._-]{1,100}$/u.test(input)
      ? `https://line.me/R/ti/p/${encodeURIComponent(input)}`
      : null;
  }
  // No verified direct profile URL is constructed for WeChat or KakaoTalk IDs.
  // Messenger IDs also stay copy-only unless an explicit m.me link was supplied.
  return null;
}
