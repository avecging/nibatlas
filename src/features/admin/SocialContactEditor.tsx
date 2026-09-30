"use client";

import { useRef, useState } from "react";
import { CONTACT_PLATFORMS, SOCIAL_PLATFORMS, channelLinkType, parseChannelLinkType, platformFor, type ChannelKind, type ChannelPlatform } from "@/src/domain/shop-channels";
import type { Row } from "./shop-contract";
import { useDialog } from "./use-dialog";
import styles from "./SocialContactEditor.module.css";

type Props = {
  links: Row[];
  disabled: boolean;
  onChange: (links: Row[]) => void;
};

export function SocialContactEditor({ links, disabled, onChange }: Props) {
  return (
    <div className={styles.columns}>
      <ChannelColumn kind="social" links={links} disabled={disabled} onChange={onChange} />
      <ChannelColumn kind="contact" links={links} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function ChannelColumn({ kind, links, disabled, onChange }: Props & { kind: ChannelKind }) {
  const platforms = kind === "social" ? SOCIAL_PLATFORMS : CONTACT_PLATFORMS;
  const channelRows = links.filter((row) => parseChannelLinkType(String(row.link_type ?? ""))?.kind === kind);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<ChannelPlatform>>(new Set());
  const modal = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); setSelected(new Set()); trigger.current?.focus(); };

  const addSelected = () => {
    const next = [...links];
    for (const platform of selected) {
      const type = channelLinkType(kind, platform);
      if (next.some((row) => row.link_type === type)) continue;
      next.push({ id: crypto.randomUUID(), link_type: type, url: null, label: null, is_official: true, sort_order: next.length });
    }
    onChange(next);
    close();
  };

  const replace = (id: string, value: string) => onChange(links.map((row) =>
    row.id === id ? { ...row, label: value, url: null, is_official: true } : row,
  ));
  const remove = (id: string) => onChange(links.filter((row) => row.id !== id));

  return (
    <section className={styles.column} aria-labelledby={`${kind}-heading`}>
      <header className={styles.columnHeader}>
        <h3 id={`${kind}-heading`}>{kind === "social" ? "Social Media" : "Contact"}</h3>
        <button ref={trigger} type="button" disabled={disabled || channelRows.length >= platforms.length} onClick={() => setOpen(true)}>Add</button>
      </header>
      {channelRows.length === 0 ? <p className={styles.empty}>No {kind === "social" ? "social profiles" : "contact channels"} added.</p> : null}
      <div className={styles.fields}>
        {channelRows.map((row) => {
          const channel = parseChannelLinkType(String(row.link_type));
          if (!channel) return null;
          const platform = platformFor(kind, channel.platform);
          if (!platform) return null;
          return (
            <div className={styles.valueRow} key={String(row.id)}>
              <label>
                <span className={styles.platformLabel}><PlatformMark mark={platform.mark} />{platform.label}</span>
                <input
                  aria-label={`${platform.label} ${kind === "social" ? "link or handle" : "number, ID or link"}`}
                  value={typeof row.label === "string" ? row.label : ""}
                  disabled={disabled}
                  maxLength={4000}
                  placeholder={kind === "social" ? "Paste a link or enter a handle" : "Phone number, ID or link"}
                  onChange={(event) => replace(String(row.id), event.target.value)}
                />
              </label>
              <button className={styles.remove} type="button" disabled={disabled} aria-label={`Remove ${platform.label}`} onClick={() => remove(String(row.id))}>Remove</button>
            </div>
          );
        })}
      </div>
      {open ? (
        <ChannelPicker kind={kind} platforms={platforms} existing={channelRows.map(row => String(row.link_type))} modal={modal} close={close} selected={selected} setSelected={setSelected} onAdd={addSelected} />
      ) : null}
    </section>
  );
}

function ChannelPicker({ kind, platforms, existing, modal, close, selected, setSelected, onAdd }: {
  kind: ChannelKind;
  platforms: readonly ({ readonly key: ChannelPlatform; readonly label: string; readonly mark: string })[];
  existing: string[];
  modal: React.RefObject<HTMLDivElement | null>;
  close: () => void;
  selected: Set<ChannelPlatform>;
  setSelected: React.Dispatch<React.SetStateAction<Set<ChannelPlatform>>>;
  onAdd: () => void;
}) {
  useDialog(modal, close);
  return (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div ref={modal} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`${kind}-picker-title`} tabIndex={-1}>
            <h3 id={`${kind}-picker-title`}>Add {kind === "social" ? "social media" : "contact"}</h3>
            <div className={styles.pickerGrid}>
              {platforms.map((platform) => {
                const isExisting = existing.includes(channelLinkType(kind, platform.key));
                return (
                  <label className={styles.option} key={platform.key}>
                    <input autoFocus={platform.key === platforms.find(item => !existing.includes(channelLinkType(kind, item.key)))?.key} type="checkbox" checked={selected.has(platform.key)} disabled={isExisting}
                      onChange={(event) => setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(platform.key); else next.delete(platform.key);
                        return next;
                      })} />
                    <PlatformMark mark={platform.mark} />
                    <span>{platform.label}{isExisting ? " · added" : ""}</span>
                  </label>
                );
              })}
            </div>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondary} onClick={close}>Cancel</button>
              <button type="button" className={styles.primary} disabled={selected.size === 0} onClick={onAdd}>Add</button>
            </div>
          </div>
        </div>
  );
}

export function PlatformMark({ mark }: { mark: string }) {
  return <span className={styles.mark} aria-hidden="true">{mark}</span>;
}
