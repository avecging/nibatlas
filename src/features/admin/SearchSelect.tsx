"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./SearchSelect.module.css";

export interface SelectChoice {
  /** The value that is persisted. */
  id: string;
  /** What a human recognises the choice by. */
  label: string;
  /** Second line: the identifier, an offset, anything clarifying. */
  detail?: string;
}

/**
 * A searchable single-choice field for lists too long for a `<select>`.
 *
 * It exists because a catalogue editor has to find one of several hundred
 * timezones, or one of a couple of hundred countries, on a phone. The stored
 * value is always the choice's `id`; the label is only how it is found.
 *
 * A value the list does not contain is never discarded: `valueLabel` decides
 * what an unlisted-but-saved value reads as, so a legacy identifier survives
 * being looked at, and clearing is always an explicit action.
 */
export function SearchSelect({
  label,
  path,
  value,
  valueLabel,
  search,
  onChange,
  listLabel,
  placeholder,
  clearLabel,
  emptyLabel = "Nothing matches that search.",
  error,
  disabled,
  describedBy,
  children,
}: {
  label: string;
  /** `data-field-path` so a correction link can find this control. */
  path: string;
  value: string;
  /** How the current value reads when the list is closed. */
  valueLabel: string;
  search: (query: string) => SelectChoice[];
  onChange: (next: string | null) => void;
  listLabel: string;
  placeholder: string;
  clearLabel: string;
  emptyLabel?: string;
  error?: string | undefined;
  disabled?: boolean | undefined;
  /** Ids of extra descriptions the caller renders below the field. */
  describedBy?: string | undefined;
  /** Help, warnings and suggestions rendered under the control. */
  children?: ReactNode;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => (open ? search(query) : []), [search, query, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open, matches.length]);

  const choose = (choice: SelectChoice) => {
    onChange(choice.id);
    setOpen(false);
    setQuery("");
    input.current?.focus();
  };

  const start = () => {
    // Re-focusing or clicking inside an open list must not wipe what was typed.
    if (disabled || open) return;
    setQuery("");
    setActive(0);
    setOpen(true);
  };

  return (
    <div className={styles.field} ref={box}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.control}>
        <input
          id={id}
          ref={input}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          data-field-path={path}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[active] ? `${id}-option-${active}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [describedBy, error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined
          }
          placeholder={placeholder}
          value={open ? query : valueLabel || value}
          onFocus={start}
          onClick={start}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                start();
                return;
              }
              setActive((current) => {
                const next = current + (event.key === "ArrowDown" ? 1 : -1);
                return matches.length ? (next + matches.length) % matches.length : 0;
              });
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              const choice = matches[active];
              if (choice) choose(choice);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
              setQuery("");
            }
          }}
        />
        {value && !disabled && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(false);
              input.current?.focus();
            }}
          >
            {clearLabel}
          </button>
        )}
      </div>
      {open && (
        <ul className={styles.list} id={listId} role="listbox" ref={list} aria-label={listLabel}>
          {matches.map((choice, index) => (
            <li
              key={choice.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={choice.id === value}
              className={index === active ? styles.active : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(choice);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className={styles.place}>{choice.label}</span>
              {choice.detail && <span className={styles.meta}>{choice.detail}</span>}
            </li>
          ))}
          {!matches.length && (
            <li className={styles.empty} role="presentation">
              {emptyLabel}
            </li>
          )}
        </ul>
      )}
      {error && (
        <small id={`${id}-error`} role="alert" className={styles.error}>
          {error}
        </small>
      )}
      {children}
    </div>
  );
}
