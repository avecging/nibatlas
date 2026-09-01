import type { CountryCode, ViewportBounds } from "@/src/domain/geo";
import type { LanguageTag } from "@/src/domain/language";

/**
 * Prototype place-search results for Milestone 1.
 *
 * Milestone 3 replaces this with the MapTiler `DestinationGeocoder` adapter.
 * Destination results are deliberately kept separate from canonical shop
 * results so the two never merge into one ranked list.
 */
export interface PrototypeDestination {
  readonly id: string;
  readonly name: string;
  readonly localName?: string;
  readonly localNameLang?: LanguageTag;
  readonly countryCode: CountryCode;
  readonly context: string;
  readonly bounds: ViewportBounds;
  readonly zoom: number;
}

export const prototypeDestinations: readonly PrototypeDestination[] = [
  {
    id: "dest-singapore",
    name: "Singapore",
    countryCode: "SG",
    context: "Country",
    bounds: { west: 103.6, south: 1.21, east: 104.03, north: 1.47 },
    zoom: 11,
  },
  {
    id: "dest-bugis",
    name: "Bugis",
    countryCode: "SG",
    context: "Neighbourhood · Singapore",
    bounds: { west: 103.845, south: 1.292, east: 103.867, north: 1.309 },
    zoom: 14,
  },
  {
    id: "dest-tokyo",
    name: "Tokyo",
    localName: "東京",
    localNameLang: "ja",
    countryCode: "JP",
    context: "Metropolis · Japan",
    bounds: { west: 139.6, south: 35.58, east: 139.85, north: 35.78 },
    zoom: 11,
  },
  {
    id: "dest-ginza",
    name: "Ginza",
    localName: "銀座",
    localNameLang: "ja",
    countryCode: "JP",
    context: "Neighbourhood · Chūō, Tokyo",
    bounds: { west: 139.755, south: 35.663, east: 139.775, north: 35.68 },
    zoom: 15,
  },
  {
    id: "dest-yokohama",
    name: "Yokohama",
    localName: "横浜",
    localNameLang: "ja",
    countryCode: "JP",
    context: "City · Kanagawa, Japan",
    bounds: { west: 139.6, south: 35.42, east: 139.68, north: 35.48 },
    zoom: 13,
  },
  {
    id: "dest-motomachi-yokohama",
    name: "Motomachi",
    localName: "元町",
    localNameLang: "ja",
    countryCode: "JP",
    context: "Shopping street · Naka, Yokohama",
    bounds: { west: 139.636, south: 35.437, east: 139.65, north: 35.448 },
    zoom: 15,
  },
  {
    id: "dest-kobe",
    name: "Kobe",
    localName: "神戸",
    localNameLang: "ja",
    countryCode: "JP",
    context: "City · Hyōgo, Japan",
    bounds: { west: 135.15, south: 34.66, east: 135.24, north: 34.72 },
    zoom: 13,
  },
  {
    id: "dest-kyoto",
    name: "Kyoto",
    localName: "京都",
    localNameLang: "ja",
    countryCode: "JP",
    context: "City · Japan",
    bounds: { west: 135.68, south: 34.94, east: 135.83, north: 35.08 },
    zoom: 12,
  },
  {
    id: "dest-osaka",
    name: "Osaka",
    localName: "大阪",
    localNameLang: "ja",
    countryCode: "JP",
    context: "City · Japan",
    bounds: { west: 135.42, south: 34.61, east: 135.58, north: 34.74 },
    zoom: 12,
  },
  {
    id: "dest-sapporo",
    name: "Sapporo",
    localName: "札幌",
    localNameLang: "ja",
    countryCode: "JP",
    context: "City · Hokkaidō, Japan",
    bounds: { west: 141.29, south: 43.02, east: 141.42, north: 43.1 },
    zoom: 12,
  },
  {
    id: "dest-taipei",
    name: "Taipei",
    localName: "臺北",
    localNameLang: "zh-Hant",
    countryCode: "TW",
    context: "City · Taiwan",
    bounds: { west: 121.48, south: 25.0, east: 121.6, north: 25.09 },
    zoom: 12,
  },
  {
    id: "dest-daan-taipei",
    name: "Da'an",
    localName: "大安",
    localNameLang: "zh-Hant",
    countryCode: "TW",
    context: "District · Taipei",
    bounds: { west: 121.52, south: 25.015, east: 121.56, north: 25.04 },
    zoom: 14,
  },
  {
    id: "dest-banqiao",
    name: "Banqiao",
    localName: "板橋",
    localNameLang: "zh-Hant",
    countryCode: "TW",
    context: "District · New Taipei City",
    bounds: { west: 121.44, south: 25.0, east: 121.49, north: 25.03 },
    zoom: 14,
  },
  {
    id: "dest-taichung",
    name: "Taichung",
    localName: "臺中",
    localNameLang: "zh-Hant",
    countryCode: "TW",
    context: "City · Taiwan",
    bounds: { west: 120.6, south: 24.1, east: 120.73, north: 24.19 },
    zoom: 12,
  },
  {
    id: "dest-tainan",
    name: "Tainan",
    localName: "臺南",
    localNameLang: "zh-Hant",
    countryCode: "TW",
    context: "City · Taiwan",
    bounds: { west: 120.15, south: 22.95, east: 120.26, north: 23.03 },
    zoom: 12,
  },
  {
    id: "dest-kaohsiung",
    name: "Kaohsiung",
    localName: "高雄",
    localNameLang: "zh-Hant",
    countryCode: "TW",
    context: "City · Taiwan",
    bounds: { west: 120.23, south: 22.58, east: 120.35, north: 22.67 },
    zoom: 12,
  },
  {
    id: "dest-changhua",
    name: "Changhua",
    localName: "彰化",
    localNameLang: "zh-Hant",
    countryCode: "TW",
    context: "County seat · Taiwan",
    bounds: { west: 120.5, south: 24.05, east: 120.59, north: 24.11 },
    zoom: 13,
  },
];
