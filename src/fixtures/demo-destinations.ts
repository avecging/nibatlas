import type { CountryCode, ViewportBounds } from "@/src/domain/geo";

/**
 * Mocked destination results for Milestone 1.
 *
 * Milestone 3 replaces this with the MapTiler `DestinationGeocoder` adapter.
 * Destination results are deliberately kept separate from canonical shop
 * results so the two never merge into one ranked list.
 */
export interface DemoDestination {
  readonly id: string;
  readonly name: string;
  readonly localName?: string;
  readonly countryCode: CountryCode;
  readonly context: string;
  readonly bounds: ViewportBounds;
  readonly zoom: number;
}

export const demoDestinations: readonly DemoDestination[] = [
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
    countryCode: "JP",
    context: "Metropolis · Japan",
    bounds: { west: 139.6, south: 35.58, east: 139.85, north: 35.78 },
    zoom: 11,
  },
  {
    id: "dest-ginza",
    name: "Ginza",
    localName: "銀座",
    countryCode: "JP",
    context: "Neighbourhood · Chūō, Tokyo",
    bounds: { west: 139.755, south: 35.663, east: 139.775, north: 35.68 },
    zoom: 15,
  },
  {
    id: "dest-kyoto",
    name: "Kyoto",
    localName: "京都",
    countryCode: "JP",
    context: "City · Japan",
    bounds: { west: 135.68, south: 34.94, east: 135.83, north: 35.08 },
    zoom: 12,
  },
  {
    id: "dest-osaka",
    name: "Osaka",
    localName: "大阪",
    countryCode: "JP",
    context: "City · Japan",
    bounds: { west: 135.42, south: 34.61, east: 135.58, north: 34.74 },
    zoom: 12,
  },
  {
    id: "dest-sapporo",
    name: "Sapporo",
    localName: "札幌",
    countryCode: "JP",
    context: "City · Hokkaidō, Japan",
    bounds: { west: 141.29, south: 43.02, east: 141.42, north: 43.1 },
    zoom: 12,
  },
  {
    id: "dest-taipei",
    name: "Taipei",
    localName: "臺北",
    countryCode: "TW",
    context: "City · Taiwan",
    bounds: { west: 121.48, south: 25.0, east: 121.6, north: 25.09 },
    zoom: 12,
  },
  {
    id: "dest-taichung",
    name: "Taichung",
    localName: "臺中",
    countryCode: "TW",
    context: "City · Taiwan",
    bounds: { west: 120.6, south: 24.1, east: 120.73, north: 24.19 },
    zoom: 12,
  },
  {
    id: "dest-tainan",
    name: "Tainan",
    localName: "臺南",
    countryCode: "TW",
    context: "City · Taiwan",
    bounds: { west: 120.15, south: 22.95, east: 120.26, north: 23.03 },
    zoom: 12,
  },
  {
    id: "dest-kaohsiung",
    name: "Kaohsiung",
    localName: "高雄",
    countryCode: "TW",
    context: "City · Taiwan",
    bounds: { west: 120.23, south: 22.58, east: 120.35, north: 22.67 },
    zoom: 12,
  },
  {
    id: "dest-changhua",
    name: "Changhua",
    localName: "彰化",
    countryCode: "TW",
    context: "County seat · Taiwan",
    bounds: { west: 120.5, south: 24.05, east: 120.59, north: 24.11 },
    zoom: 13,
  },
];
