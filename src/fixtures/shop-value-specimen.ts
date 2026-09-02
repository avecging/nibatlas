import { countryLabel } from "@/src/domain/geo";
import { languageTag } from "@/src/domain/language";
import type { ShopDetail } from "@/src/domain/shop-detail";
import {
  ACCESS_EVIDENCE_TOKENS,
  exclusiveEvidenceToken,
  experienceEvidenceToken,
  PRACTICAL_EVIDENCE_TOKENS,
  serviceEvidenceToken,
} from "@/src/domain/shop-evidence";
import { inkForStampKey, STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";
import { PROTOTYPE_DESIGN_VERSION } from "@/src/fixtures/prototype-catalogue";

/**
 * A specimen record for the component styleguide.
 *
 * WP4 builds the pen-specific value layer, and no source in this repository
 * publishes a service, an in-store experience, a shop-only item, a station, a
 * payment method or a language for any of the ten real catalogue shops. Accepted
 * decision 4 forbids inventing them, so the real pages show the gap state
 * instead — which leaves the design of the populated state unreviewable.
 *
 * This is that specimen: an invented record, marked `demo`, carrying its own
 * fixture notice, named so it cannot be mistaken for a business, and rendered
 * **only** on `/styleguide`, which is internal and `noindex`. It never reaches a
 * shop page, the map, search, or the Passport, and `prototype-catalogue.ts` does
 * not import it.
 *
 * Its `confirmedBy` references resolve against its own specimen source, and that
 * source's `confirms` list is built from the same evidence tokens the validator
 * compares — so the record satisfies the rule the way a real sourced record will
 * have to, rather than bypassing it.
 */
const SPECIMEN_SOURCE_ID = "00000000-0000-4000-8000-000000000201";
const SPECIMEN_SOURCE_LABEL =
  "Specimen record — component styleguide only, not a real business";

export const SHOP_VALUE_SPECIMEN_NOTICE =
  "Specimen — an invented record for component review, not a real business";

export const shopValueSpecimen: ShopDetail = {
  id: "specimen-shop-value",
  slug: "specimen-shop-value",
  name: "Specimen Pen Bench",
  localName: "見本万年筆店",
  localNameLang: languageTag("ja"),
  countryCode: "JP",
  localityName: "Specimen locality",
  position: { latitude: 35.6721, longitude: 139.7669 },
  primaryType: "nib_repair_services",
  specialtyLine: "Same-day nib alignment at the bench",
  operationalStatus: "open",
  markerState: "unvisited",
  sourceQuality: "demo",
  fixtureNotice: SHOP_VALUE_SPECIMEN_NOTICE,
  shortDescription:
    "A specimen record showing the populated shape of the shop value layer: services with an access mode and a duration, in-store experiences, and something available only here.",
  addressLines: ["1 Specimen Street", "Specimen locality"],
  timezone: "Asia/Tokyo",
  shopTypes: ["nib_repair_services", "fountain_pen_specialist"],
  specialties: ["Nib grinding", "Vintage restoration"],
  services: [
    {
      label: "Nib alignment & tuning",
      accessMode: "walk_in",
      duration: "~30 min",
      confirmedBy: SPECIMEN_SOURCE_ID,
    },
    {
      label: "Custom grind",
      accessMode: "booking",
      duration: "3–5 days",
      note: "Bring the pen you want ground.",
      confirmedBy: SPECIMEN_SOURCE_ID,
    },
    {
      label: "Vintage sac replacement",
      accessMode: "send_in",
      confirmedBy: SPECIMEN_SOURCE_ID,
    },
  ],
  experiences: [
    {
      label: "Test bench",
      detail: "40+ nibs to write with, free of charge.",
      bookingRequired: false,
      confirmedBy: SPECIMEN_SOURCE_ID,
    },
    {
      label: "Monthly nib clinic",
      bookingRequired: true,
      confirmedBy: SPECIMEN_SOURCE_ID,
    },
  ],
  exclusives: [
    {
      label: "House ink — Bench No.4",
      detail: "Mixed on site and sold in store only.",
      confirmedBy: SPECIMEN_SOURCE_ID,
    },
  ],
  access: {
    nearestStation: { value: "Specimen Station, exit B2", confirmedBy: SPECIMEN_SOURCE_ID },
    walkFromStation: { value: "4 minutes on foot", confirmedBy: SPECIMEN_SOURCE_ID },
    floorNote: {
      value: "Third floor of the Specimen Building; use the rear lift.",
      confirmedBy: SPECIMEN_SOURCE_ID,
    },
    accessibilityNote: {
      value: "Step-free from the lift lobby.",
      confirmedBy: SPECIMEN_SOURCE_ID,
    },
  },
  practical: {
    paymentMethods: { values: ["Cash", "Credit card"], confirmedBy: SPECIMEN_SOURCE_ID },
    languages: { values: ["Japanese", "English"], confirmedBy: SPECIMEN_SOURCE_ID },
    appointmentRequired: { value: false, confirmedBy: SPECIMEN_SOURCE_ID },
  },
  positionPrecision: "street",
  sources: [
    {
      id: SPECIMEN_SOURCE_ID,
      label: SPECIMEN_SOURCE_LABEL,
      retrievedOn: "2026-08-27",
      kind: "demo_fixture",
      // The field-level evidence list, in the canonical token form the validator
      // compares. Built from the helpers rather than typed out, so the specimen
      // cannot drift out of agreement with the claims above.
      confirms: [
        "Specimen content only",
        serviceEvidenceToken("Nib alignment & tuning"),
        serviceEvidenceToken("Custom grind"),
        serviceEvidenceToken("Vintage sac replacement"),
        experienceEvidenceToken("Test bench"),
        experienceEvidenceToken("Monthly nib clinic"),
        exclusiveEvidenceToken("House ink — Bench No.4"),
        ACCESS_EVIDENCE_TOKENS.nearestStation,
        ACCESS_EVIDENCE_TOKENS.walkFromStation,
        ACCESS_EVIDENCE_TOKENS.floorNote,
        ACCESS_EVIDENCE_TOKENS.accessibilityNote,
        PRACTICAL_EVIDENCE_TOKENS.paymentMethods,
        PRACTICAL_EVIDENCE_TOKENS.languages,
        PRACTICAL_EVIDENCE_TOKENS.appointmentRequired,
      ],
    },
  ],
  stamp: {
    id: "stamp-specimen-shop-value",
    tier: "shop",
    motif: "workbench",
    ink: inkForStampKey("stamp-specimen-shop-value"),
    localityLabel: "Specimen locality",
    countryLabel: countryLabel("JP"),
    designVersion: PROTOTYPE_DESIGN_VERSION,
    paletteVersion: STAMP_PALETTE_VERSION,
  },
};
