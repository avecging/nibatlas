"use client";
import { useCallback, useId } from "react";
import { isCountryCode } from "@/src/domain/geo";
import { SearchSelect, type SelectChoice } from "./SearchSelect";
import { countryChoices, countryName, matchCountries } from "./countries";

/**
 * The approved friendly country selector.
 *
 * A human searches by country name; the stored value is still the two-letter
 * code the contract has always held. A saved code this runtime cannot name is
 * shown as the code and kept — the selector never narrows what storage accepts.
 */
export function CountryField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string | null) => void;
  error?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const id = useId();
  const search = useCallback((query: string): SelectChoice[] => {
    const matches: SelectChoice[] = matchCountries(query).map((choice) => ({
      id: choice.code,
      label: choice.name,
      detail: choice.code,
    }));
    // The contract accepts any two uppercase ASCII letters so a new country
    // never needs a code release (see src/domain/geo.ts). A selector that only
    // offered names this runtime knows would quietly take that away, so a typed
    // code the list does not hold is offered as its own choice.
    const typed = query.trim().toUpperCase();
    if (isCountryCode(typed) && !matches.some((match) => match.id === typed))
      matches.unshift({
        id: typed,
        label: `Use the code ${typed}`,
        detail: "This browser has no name for it. It is stored exactly as typed.",
      });
    return matches;
  }, []);
  const unnamed = value !== "" && isCountryCode(value) && countryName(value) === value;
  const malformed = value !== "" && !isCountryCode(value);

  return (
    <SearchSelect
      label="Country"
      path="shop.country_code"
      value={value}
      valueLabel={
        value ? (countryName(value) === value ? value : `${countryName(value)} (${value})`) : ""
      }
      search={search}
      onChange={(next) => onChange(next ? next.toUpperCase() : null)}
      listLabel="Countries"
      placeholder="Search a country, for example Japan"
      clearLabel="Clear country"
      emptyLabel={
        countryChoices().length
          ? "No country matches that search. A two-letter code can be entered directly."
          : "This browser did not provide a country list. Type a two-letter code such as SG and choose it."
      }
      error={error}
      disabled={disabled}
      describedBy={`${id}-help${unnamed || malformed ? ` ${id}-note` : ""}`}
    >
      {malformed && (
        <small id={`${id}-note`}>
          {value} is not a two-letter country code. It is kept as saved; choose a
          country from the list to correct it.
        </small>
      )}
      {unnamed && (
        <small id={`${id}-note`}>
          This browser has no name for {value}. The saved code is unchanged.
        </small>
      )}
      <small id={`${id}-help`}>
        Saved as the two-letter code, for example SG. The locality below must
        belong to the country chosen here.
      </small>
    </SearchSelect>
  );
}
