"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  isValidTimezone,
  matchTimezones,
  timezoneChoices,
  timezoneLabel,
  type TimezoneChoice,
} from "./timezones";
import styles from "./TimezoneField.module.css";

/**
 * A searchable list of every IANA zone the platform supports, showing the
 * readable place and its current UTC offset while persisting the identifier.
 *
 * The offset is shown to help a human recognise the right place. It is never
 * what is saved: a fixed offset is not a timezone, so `Etc/…` entries sort last
 * and are labelled as fixed offsets rather than as a location.
 */
export function TimezoneField({
  value,
  onChange,
  error,
  disabled,
  suggestion,
}: {
  value: string;
  onChange: (value: string | null) => void;
  error?: string | undefined;
  disabled?: boolean;
  /** Offered when the field is empty; never applied automatically. */
  suggestion?: string | undefined;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // The full set is derived once per mounted field. `value` is passed as `keep`
  // so a legacy identifier the runtime no longer lists stays selectable.
  const choices = useMemo(() => timezoneChoices(value), [value]);
  const matches = useMemo(
    () => (open ? matchTimezones(choices, query) : []),
    [choices, query, open],
  );
  const selected = choices.find((c) => c.id === value);

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

  const choose = (choice: TimezoneChoice) => {
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

  const invalid = value !== "" && !isValidTimezone(value);
  const described = [
    `${id}-help`,
    error ? `${id}-error` : "",
    invalid && !error ? `${id}-invalid` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field} ref={box}>
      <label htmlFor={id}>Timezone</label>
      <div className={styles.control}>
        <input
          id={id}
          ref={input}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          data-field-path="shop.timezone"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[active] ? `${id}-option-${active}` : undefined
          }
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={described}
          placeholder="Search a city or region, for example Singapore"
          value={open ? query : selected ? timezoneLabel(selected) : value}
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
                return matches.length
                  ? (next + matches.length) % matches.length
                  : 0;
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
            Clear timezone
          </button>
        )}
      </div>
      {open && (
        <ul className={styles.list} id={listId} role="listbox" ref={list} aria-label="Timezones">
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
              <span className={styles.place}>
                {choice.place}
                {choice.region ? `, ${choice.region}` : ""}
              </span>
              <span className={styles.meta}>
                {choice.offset || "offset unavailable"}
                {choice.fixedOffset ? " · fixed offset, not a place" : ""} · {choice.id}
              </span>
            </li>
          ))}
          {!matches.length && (
            <li className={styles.empty} role="presentation">
              {choices.length
                ? "No timezone matches that search."
                : "This browser did not provide a timezone list. Type an IANA name such as Asia/Singapore."}
            </li>
          )}
        </ul>
      )}
      {error && (
        <small id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
      {invalid && !error && (
        <small id={`${id}-invalid`}>
          {value} is not a timezone this browser recognises. It is kept as saved;
          choose a replacement from the list if it is wrong.
        </small>
      )}
      <small id={`${id}-help`}>
        Saved as an IANA identifier such as Asia/Singapore. Offsets shown are the
        current offset, not what is stored.
        {suggestion && !value ? ` Suggested for this country: ${suggestion}.` : ""}
      </small>
      {suggestion && !value && !disabled && (
        <button type="button" onClick={() => onChange(suggestion)}>
          Use {suggestion}
        </button>
      )}
    </div>
  );
}
