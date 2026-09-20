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
  const search = useCallback(
    (query: string): SelectChoice[] =>
      matchCountries(query).map((choice) => ({
        id: choice.code,
        label: choice.name,
        detail: choice.code,
      })),
    [],
  );
  const unnamed = value !== "" && isCountryCode(value) && countryName(value) === value;
  const malformed = value !== "" && !isCountryCode(value);

  return (
    <SearchSelect
      label="Country"
      path="shop.country_code"
      value={value}
      valueLabel={value ? `${countryName(value)} (${value})` : ""}
      search={search}
      onChange={(next) => onChange(next ? next.toUpperCase() : null)}
      listLabel="Countries"
      placeholder="Search a country, for example Japan"
      clearLabel="Clear country"
      emptyLabel={
        countryChoices().length
          ? "No country matches that search."
          : "This browser did not provide a country list. Type a two-letter code such as SG."
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
