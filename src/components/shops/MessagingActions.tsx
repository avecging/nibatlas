"use client";

import { useState } from "react";
import { CONTACT_PLATFORMS, type ContactPlatform } from "@/src/domain/shop-channels";
import type { ShopContactChannel } from "@/src/domain/shop-detail";
import styles from "./MessagingActions.module.css";

export function MessagingActions({ channels }: { channels: readonly ShopContactChannel[] }) {
  const [message, setMessage] = useState("");
  if (!channels.length) return null;

  const contact = async (channel: ShopContactChannel) => {
    const smallScreen = window.matchMedia("(max-width: 767px)").matches;
    if (smallScreen && channel.url) {
      // HTTPS universal/app links may open an installed app or its website.
      // We deliberately do not claim to detect a failed app launch.
      window.location.assign(channel.url);
      return;
    }
    const copiedText = channel.value;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(copiedText);
      else copyFallback(copiedText);
      setMessage(`${channel.value.startsWith("http") ? "Link copied" : "Copied"} · ${label(channel.platform)}`);
    } catch {
      try {
        copyFallback(copiedText);
        setMessage(`${channel.value.startsWith("http") ? "Link copied" : "Copied"} · ${label(channel.platform)}`);
      } catch {
        setMessage("Could not copy. Select the contact field on the page.");
      }
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.icons} aria-label="Messaging and contact">
        {channels.map((channel) => (
          <button key={channel.platform} type="button" aria-label={`Contact shop on ${label(channel.platform)}`} onClick={() => void contact(channel)}>
            <span className={styles.mark} aria-hidden="true">{mark(channel.platform)}</span>
            <span className={styles.name}>{label(channel.platform)}</span>
          </button>
        ))}
      </div>
      <p className={styles.status} aria-live="polite">{message}</p>
    </div>
  );
}

function label(platform: ContactPlatform): string {
  return CONTACT_PLATFORMS.find((item) => item.key === platform)?.label ?? platform;
}
function mark(platform: ContactPlatform): string {
  return CONTACT_PLATFORMS.find((item) => item.key === platform)?.mark ?? platform[0]!.toUpperCase();
}
function copyFallback(text: string) {
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy unavailable");
}
