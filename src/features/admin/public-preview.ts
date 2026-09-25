import { decodeEditorialContent, decodeShopDetailV1 } from '@/src/api/v1/shop-read';
import type { ShopDetail } from '@/src/domain/shop-detail';
import { projectShopDetail } from '@/src/features/shops/shop-detail-projection';
import type { Options, Row, ShopRecord } from './shop-contract';

/** Preview-only projection of a saved document as it would appear after editorial
 * publication. Never fed to a writer or the public API. Only public fields cross
 * this boundary; no invented review date, position or source is supplied. */
export function projectSavedShopPreview(record: ShopRecord, options: Options): ShopDetail | null {
  const d = record.document, s = d.shop;
  const selected = (group: 'types' | 'specialties' | 'services' | 'brands', key: string) =>
    (options[group] ?? []).filter(o => d[group].some(r => r[key] === o.id));
  const types = selected('types', 'shop_type_id').sort((a, b) =>
    Number(d.types.find(r => r.shop_type_id === b.id)?.is_primary === true) -
    Number(d.types.find(r => r.shop_type_id === a.id)?.is_primary === true));
  const locality = options.localities?.find(o => o.id === s.locality_id);
  const suffix = ` (${locality?.countryCode})`;
  const localityName = locality?.label.endsWith(suffix) ? locality.label.slice(0, -suffix.length) : locality?.label;
  const aliases = d.aliases.filter(a => a.alias_type === 'local_name').sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const hours = s.opening_hours as Row | null;
  const specialties = selected('specialties', 'specialty_id').map(o => o.label);
  const services = selected('services', 'service_id').map(o => {
    const row = d.services.find(r => r.service_id === o.id)!;
    return { label: o.label, reviewedEditorially: true as const, ...(typeof row.note === 'string' ? {note: row.note} : {}) };
  });
  // SQL jsonb_strip_nulls semantics, including nested nullable hours fields.
  const withoutNulls = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withoutNulls);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([,v]) => v != null).map(([k,v]) => [k,withoutNulls(v)]));
    return value;
  };
  try {
    const wire = decodeShopDetailV1({
      ...withoutNulls({
        id: record.id, slug: s.slug, name: s.name,
        localName: aliases[0]?.alias, localNameLang: aliases[0]?.language_tag,
        countryCode: s.country_code, localityName: localityName ?? s.city_display ?? s.country_code,
        position: {latitude: s.latitude, longitude: s.longitude},
        positionPrecision: s.position_precision, timezone: s.timezone,
        primaryType: types[0]?.code, primaryTypeLabel: types[0]?.label,
        shopTypes: types.map(o => o.code), shopTypeLabels: Object.fromEntries(types.map(o => [o.code, o.label])),
        markerState: 'unvisited', operationalStatus: s.operational_status, sourceQuality: s.source_quality,
        fixtureNotice: s.source_quality === 'demo' ? 'Demo data' : undefined,
        shortDescription: s.short_description, addressLines: [s.address_line_1, s.address_line_2].filter(v => v != null),
        postalCode: s.postal_code, phone: s.phone, websiteUrl: s.website_url, neighbourhood: s.neighbourhood,
        openingHours: hours?.entries, openingHoursExceptions: hours?.exceptions, openingHoursNote: hours?.note,
        specialties, brands: selected('brands', 'brand_id').map(o => o.label),
        // Source-less services are editorially reviewed only when publishing.
        // Add their preview shape after public decoding, without inventing a review timestamp.
        services: [],
        links: d.links.filter(r => r.is_official === true).sort((a,b) => Number(a.sort_order ?? 0)-Number(b.sort_order ?? 0) || String(a.id).localeCompare(String(b.id))).map(r => ({type:r.link_type,label:r.label,url:r.url,isOfficial:true})),
        sources: d.sources.map(r => ({id:r.id,label:r.label,kind:r.source_type,url:r.source_url,retrievedOn:String(r.checked_at).slice(0,10),confirms:r.claims ?? []})),
      }) as Record<string, unknown>,
      specialtyLine: specialties[0] ?? services[0]?.label ?? null,
    });
    if (!wire) return null;
    return {...projectShopDetail(wire, {demoRecords: true}), services,
      editorial: decodeEditorialContent({...s, experiences: d.experiences})};
  } catch {
    // An incomplete draft cannot honestly stand in for a public record. The
    // editor and its field-level Fix actions remain available outside the frame.
    return null;
  }
}
