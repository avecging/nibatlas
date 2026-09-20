import { normalizeShopCreate, normalizeShopDocument, ShopValidationError } from '../shop-normalization';
import { UUID, type Document, type Options } from '../shop-contract';
import { SCALARS, type Context, type MappedRow, type Prepared } from './contract';

export async function proposedIdentity(batchId: string, rowId: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([batchId, rowId]))));
  hash[6] = (hash[6]! & 15) | 80; hash[8] = (hash[8]! & 63) | 128;
  const s = [...hash.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export function prepareRow(row: MappedRow, context: Context, options: Options, proposedId: string): Prepared {
  const target = context.record, input = row.cells, issues = [...row.issues];
  const preview: Prepared['preview'] = { rowId: row.rowId, line: row.line, name: input.name?.trim() || String(target?.document.shop.name ?? ''), targetId: target?.id ?? null, revision: target?.revision ?? null, action: 'blocked', issues, candidates: context.candidates, fileDuplicates: row.fileDuplicates, changes: [], publicationErrors: [], hasPrivateChanges: target?.hasChanges ?? false };
  const fail = (path: string, message: string) => issues.push({ path, message });
  if (input.shop_id?.trim() && (!UUID.test(input.shop_id.trim()) || !target)) fail('shop_id', 'Use the exact existing shop ID; no matching record was found. Do not use a name as an update target.');
  if (target?.publicationStatus === 'archived') fail('shop_id', 'Archived shops cannot be updated.');
  if (context.conflict) fail('shop_id', 'The private copy is based on an older public revision. Resolve it in the editor, then preview again.');
  if (context.truncated) fail('duplicates', 'More than 10 matches exist. Narrow the name/country or inspect the catalogue before proceeding.');
  let base: Document;
  try {
    base = target ? structuredClone(target.document) : normalizeShopDocument({ shop: { ...normalizeShopCreate({ name: input.name, slug: input.slug }, proposedId), operational_status: 'unknown', source_quality: 'community_unverified', position_precision: 'locality' }, sources: [], aliases: [], links: [], types: [], services: [], specialties: [], brands: [], experiences: [] });
  } catch (e) {
    if (!(e instanceof ShopValidationError)) throw e;
    issues.push(...e.issues); return { preview, document: null, proposedId };
  }
  const merged = structuredClone(base);
  const scalarKeys = new Set(SCALARS.map(f => f.key));
  const clearable = new Set([...scalarKeys, 'country', 'locality', 'shop_type', 'brands', 'specialties']);
  const clears = new Set((input.clear_fields ?? '').split('|').map(s => s.trim()).filter(Boolean));
  for (const field of clears) {
    if (!clearable.has(field) || ['name', 'slug', 'position_precision', 'operational_status'].includes(field)) fail('clear_fields', `The field ${field.slice(0, 100)} cannot be cleared here.`);
    if (input[field]?.trim()) fail(field, 'Choose either a supplied value or an explicit clear, not both.');
  }
  for (const field of scalarKeys) {
    if (field === 'slug' && target && (clears.has(field) || input[field]?.trim() && input[field]!.trim() !== target.document.shop.slug)) { fail('slug', 'Existing public URLs are preserved. Remove this slug change from the import.'); continue; }
    if (clears.has(field)) merged.shop[field] = null;
    else if (input[field]?.trim()) merged.shop[field] = input[field]!.trim();
  }
  for (const [field, key] of [['country', 'country_code'], ['locality', 'locality_id']] as const) {
    if (clears.has(field)) merged.shop[key] = null;
    else if (input[field]?.trim()) merged.shop[key] = input[field]!.trim();
  }
  for (const [field, group, key] of [['shop_type', 'types', 'shop_type_id'], ['brands', 'brands', 'brand_id'], ['specialties', 'specialties', 'specialty_id']] as const) {
    if (clears.has(field)) merged[group] = [];
    else if (input[field]?.trim() && !row.issues.some(i => i.path === field)) {
      const ids = input[field]!.split('|');
      // Supplied relationships add/reuse, preserving legacy notes and source links.
      if (group === 'types') merged.types.forEach(r => { r.is_primary = r[key] === ids[0]; });
      for (const id of ids) if (!merged[group].some(r => r[key] === id)) merged[group].push({ [key]: id, ...(group === 'types' ? { is_primary: true } : {}) });
    }
  }
  let normalized: Document | null = null;
  try { normalized = normalizeShopDocument(merged, options); }
  catch (e) { if (!(e instanceof ShopValidationError)) throw e; issues.push(...e.issues); }
  if (normalized) {
    // Normalization validates the complete merged shape, but untouched legacy
    // values are not correction targets. Keep their exact current bytes/IDs.
    if (target) {
      for (const key of Object.keys(base.shop)) {
        const field = key === 'country_code' ? 'country' : key === 'locality_id' ? 'locality' : key;
        if (!input[field]?.trim() && !clears.has(field)) normalized.shop[key] = base.shop[key]!;
      }
      for (const group of ['sources', 'aliases', 'links', 'experiences', 'services'] as const) normalized[group] = structuredClone(base[group]);
      for (const [field, group] of [['shop_type', 'types'], ['brands', 'brands'], ['specialties', 'specialties']] as const) {
        if (!input[field]?.trim() && !clears.has(field)) normalized[group] = structuredClone(base[group]);
        else if (!clears.has(field)) normalized[group] = normalized[group].map(row => {
          const key = group === 'types' ? 'shop_type_id' : group === 'brands' ? 'brand_id' : 'specialty_id';
          const original = base[group].find(old => old[key] === row[key]);
          return original ? { ...structuredClone(original), ...(group === 'types' ? { is_primary: row.is_primary! } : {}) } : row;
        });
      }
    }
    for (const [key, after] of Object.entries(normalized.shop)) {
      const before = base.shop[key] ?? null;
      if (JSON.stringify(before) !== JSON.stringify(after) || !target && after !== null) preview.changes.push({ field: key, before: target ? before : null, after, clear: clears.has(key) || clears.has(key === 'country_code' ? 'country' : key === 'locality_id' ? 'locality' : '') });
    }
    for (const [field, group] of [['shop_type', 'types'], ['brands', 'brands'], ['specialties', 'specialties']] as const) {
      if (JSON.stringify(base[group]) !== JSON.stringify(normalized[group])) preview.changes.push({ field, before: base[group], after: normalized[group], clear: clears.has(field) });
    }
  }
  preview.action = issues.length ? 'blocked' : context.candidates.length || row.fileDuplicates.length ? 'review_duplicates' : target ? preview.changes.length ? 'update_private_draft' : 'no_change' : 'new_private_draft';
  return { preview, document: issues.length ? null : normalized, proposedId };
}
