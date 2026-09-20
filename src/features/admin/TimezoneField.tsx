"use client";
import { useCallback, useId, useMemo } from "react";
import { SearchSelect, type SelectChoice } from "./SearchSelect";
import {
  isValidTimezone,
  matchTimezones,
  timezoneChoices,
  timezoneLabel,
} from "./timezones";

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
  disabled?: boolean | undefined;
  /** Offered when the field is empty; never applied automatically. */
  suggestion?: string | undefined;
}) {
  const id = useId();
  // The full set is derived once per mounted field. `value` is passed as `keep`
  // so a legacy identifier the runtime no longer lists stays selectable.
  const choices = useMemo(() => timezoneChoices(value), [value]);
  const selected = choices.find((c) => c.id === value);
  const search = useCallback(
    (query: string): SelectChoice[] =>
      matchTimezones(choices, query).map((choice) => ({
        id: choice.id,
        label: choice.region ? `${choice.place}, ${choice.region}` : choice.place,
        detail: `${choice.offset || "offset unavailable"}${
          choice.fixedOffset ? " · fixed offset, not a place" : ""
        } · ${choice.id}`,
      })),
    [choices],
  );
  const invalid = value !== "" && !isValidTimezone(value);

  return (
    <SearchSelect
      label="Timezone"
      path="shop.timezone"
      value={value}
      valueLabel={selected ? timezoneLabel(selected) : ""}
      search={search}
      onChange={onChange}
      listLabel="Timezones"
      placeholder="Search a city or region, for example Singapore"
      clearLabel="Clear timezone"
      emptyLabel={
        choices.length
          ? "No timezone matches that search."
          : "This browser did not provide a timezone list. Type an IANA name such as Asia/Singapore."
      }
      error={error}
      disabled={disabled}
      describedBy={`${id}-help${invalid && !error ? ` ${id}-invalid` : ""}`}
    >
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
    </SearchSelect>
  );
}
