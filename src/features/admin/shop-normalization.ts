import { document, GROUPS, HOURS_FIELDS, SHOP_FIELDS, UUID, type Document, type Field, type Row } from './shop-contract';

export interface FieldIssue { path: string; message: string }
export class ShopValidationError extends Error {
  constructor(readonly issues: FieldIssue[]) {
    super('Correct the highlighted fields. Your edits have not been saved.');
  }
}

/** Shared by manual writes and future mapped imports. No catalogue lookup or mutation.
 * Accepts a COMPLETE document only: import patches must first be merged against
 * the reviewed private revision, preserving omitted/blank fields and identities.
 * Does not confer review, position confirmation or publication readiness.
 */
export function normalizeShopDocument(input: unknown): Document {
  const issues: FieldIssue[] = [];
  const issue = (path: string, message: string) => {
    if (issues.length < 100) issues.push({ path, message });
  };
  const obj = (v: unknown, path: string): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      issue(path, 'Supply a complete record.'); return {};
    }
    return v as Record<string, unknown>;
  };
  const list = (v: unknown, path: string): unknown[] => {
    if (!Array.isArray(v) || v.length > 100) {
      issue(path, 'Supply a list with at most 100 items.'); return [];
    }
    return v;
  };
  const parse = (value: unknown, spec: Field[], path: string, extras: string[] = []): Row => {
    const raw = obj(value, path), result: Row = {};
    if (Object.keys(raw).some(k => !spec.some(f => f.key === k) && !extras.includes(k)))
      issue(path, 'Remove unsupported fields.');
    for (const f of spec) {
      const at = `${path}.${f.key}`;
      let v = raw[f.key];
      if (typeof v === 'string') v = v.trim();
      if (v === undefined || v === null || v === '') {
        if (f.required) issue(at, `Add ${f.label.toLowerCase()}.`);
        result[f.key] = f.kind === 'claims' ? [] : null;
        continue;
      }
      if (f.kind === 'number') {
        // Decimal strings from mapped CSV cells are accepted; hex, infinity,
        // exponents and partial numeric strings are never silently coerced.
        if (typeof v === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v)) v = Number(v);
        if (typeof v !== 'number' || !Number.isFinite(v)) issue(at, 'Enter a finite decimal number.');
        else result[f.key] = v;
      } else if (f.kind === 'boolean') {
        if (v === 'true' || v === 'false') v = v === 'true';
        if (typeof v !== 'boolean') issue(at, 'Choose Yes, No or Unknown.');
        else result[f.key] = v;
      } else if (f.kind === 'claims') {
        const claims: string[] = [];
        for (const entry of list(v, at)) {
          if (typeof entry !== 'string' || entry.trim().length > 200) issue(at, 'Use claim text of at most 200 characters.');
          else if (entry.trim()) claims.push(entry.trim());
        }
        result[f.key] = [...new Set(claims)];
      } else if (typeof v !== 'string') issue(at, 'Enter text.');
      else {
        const max = path === 'shop' && f.key === 'name' ? 300 : path === 'shop' && f.key === 'slug' ? 120 : 4000;
        if (v.length > max) issue(at, `Use at most ${max} characters.`);
        const t = f.key === 'country_code' ? v.toUpperCase() : v;
        if (f.choices && !f.choices.includes(t)) issue(at, 'Choose an available option.');
        if (f.vocabulary && !UUID.test(t)) issue(at, 'Choose an existing item or resolve its mapping.');
        if (f.kind === 'date' && !validDate(t)) issue(at, 'Enter a real ISO date or timestamp no later than now.');
        if (['url', 'website_url', 'source_url'].includes(f.key) && !validWebUrl(t)) issue(at, 'Enter a complete http:// or https:// link.');
        result[f.key] = f.vocabulary ? t.toLowerCase() : t;
      }
    }
    return result;
  };
  const d = obj(input, 'document');
  if (Object.keys(d).some(k => k !== 'shop' && !GROUPS.some(g => g.key === k))) issue('document', 'Remove unsupported sections.');
  const shop = parse(d.shop, SHOP_FIELDS, 'shop', ['opening_hours']);
  const rawShop = obj(d.shop, 'shop');
  shop.opening_hours = null;
  if (rawShop.opening_hours != null) {
    const h = obj(rawShop.opening_hours, 'shop.opening_hours');
    const note = parse(h, [{ key: 'note', label: 'Hours summary' }], 'shop.opening_hours', ['entries']);
    const entries = h.entries === undefined ? [] : list(h.entries, 'shop.opening_hours.entries').map((v, i) => {
      const at = `shop.opening_hours.entries.${i}`, r = parse(v, HOURS_FIELDS, at);
      for (const key of ['opens', 'closes']) {
        if (r[key] != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(r[key]))) issue(`${at}.${key}`, 'Use 24-hour HH:MM.');
        if (r[key] == null && r[key === 'opens' ? 'closes' : 'opens'] != null) issue(`${at}.${key}`, 'Supply both opening and closing times.');
      }
      if (r.closed === true && (r.opens != null || r.closes != null)) issue(`${at}.closed`, 'Remove times or choose No for closed.');
      // Split and overnight spans remain valid; never discard them.
      return r;
    });
    shop.opening_hours = { ...(note.note ? { note: note.note } : {}), entries };
  }
  const result = { shop } as Document;
  for (const g of GROUPS) {
    const hasId = ['sources', 'aliases', 'links'].includes(g.key);
    result[g.key] = list(d[g.key], g.key).map((v, i) => {
      const path = `${g.key}.${i}`, r = parse(v, g.fields, path, hasId ? ['id'] : []);
      if (hasId) {
        const id = obj(v, path).id;
        if (typeof id !== 'string' || !UUID.test(id)) issue(path, 'Keep the existing item identity or create a new item.');
        else r.id = id.toLowerCase();
      }
      return r;
    });
    const identity = hasId ? 'id' : g.fields[0]!.key, seen = new Set<unknown>();
    result[g.key].forEach((r, i) => {
      if (r[identity] != null && seen.has(r[identity])) issue(`${g.key}.${i}.${identity}`, 'Remove the duplicate item.');
      seen.add(r[identity]);
    });
  }
  if (typeof shop.slug === 'string' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(shop.slug)) issue('shop.slug', 'Use lowercase letters, numbers and single hyphens.');
  if (shop.country_code != null && !/^[A-Z]{2}$/.test(String(shop.country_code))) issue('shop.country_code', 'Use a two-letter country code.');
  if (shop.timezone != null) {
    try { new Intl.DateTimeFormat('en', { timeZone: String(shop.timezone) }); }
    catch { issue('shop.timezone', 'Enter a timezone such as Asia/Singapore.'); }
  }
  for (const [key, limit] of [['latitude', 90], ['longitude', 180]] as const) {
    const v = shop[key];
    if (typeof v === 'number' && Math.abs(v) > limit) issue(`shop.${key}`, `Enter a value between −${limit} and ${limit}.`);
    if (v == null && shop[key === 'latitude' ? 'longitude' : 'latitude'] != null) issue(`shop.${key}`, 'Supply both latitude and longitude, or leave both unknown.');
  }
  result.aliases.forEach((r, i) => {
    if (typeof r.language_tag === 'string' && !/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(r.language_tag)) issue(`aliases.${i}.language_tag`, 'Use a language tag such as ja-JP.');
  });
  result.links.forEach((r, i) => {
    if (typeof r.sort_order === 'number' && (!Number.isInteger(r.sort_order) || r.sort_order < 0 || r.sort_order > 1000)) issue(`links.${i}.sort_order`, 'Use a whole number from 0 to 1000.');
  });
  for (const [group, key] of [['aliases', 'alias'], ['links', 'url']] as const) {
    const seen = new Set<string>();
    result[group].forEach((r, i) => {
      const v = String(r[key] ?? ''), comparable = group === 'aliases' ? v.toLowerCase() : v;
      if (seen.has(comparable)) issue(`${group}.${i}.${key}`, 'Remove the duplicate item.');
      seen.add(comparable);
    });
  }
  if (result.types.filter(r => r.is_primary === true).length > 1) issue('types', 'Choose only one primary shop type.');
  const sources = new Set(result.sources.map(r => r.id));
  for (const group of ['types', 'services', 'specialties', 'brands'] as const) result[group].forEach((r, i) => {
    if (r.source_id != null && !sources.has(r.source_id)) issue(`${group}.${i}.source_id`, 'Choose a source belonging to this shop.');
  });
  if (issues.length) throw new ShopValidationError(issues);
  return document(result);
}

export function validWebUrl(value: string): boolean {
  if (!/^https?:\/\/[^\s]+$/i.test(value)) return false;
  try { const url = new URL(value); return !!url.hostname && !url.username && !url.password && ['http:', 'https:'].includes(url.protocol); }
  catch { return false; }
}
function validDate(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now()) return false;
  return new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) === match[1];
}

/** Names are never used to regenerate existing slugs. Called only on creation. */
export function normalizeShopCreate(input: unknown, id: string): { name: string; slug: string } {
  const r = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const issues: FieldIssue[] = [];
  if (!UUID.test(id) || Object.keys(r).some(k => !['name', 'slug'].includes(k))) issues.push({ path: 'document', message: 'Supply a shop name and optional URL name.' });
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name || name.length > 300) issues.push({ path: 'name', message: 'Enter a shop name of 1–300 characters.' });
  let slug = typeof r.slug === 'string' ? r.slug.trim() : '';
  if (r.slug != null && typeof r.slug !== 'string') issues.push({ path: 'slug', message: 'Enter a URL name as text.' });
  if (!slug) {
    const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '');
    slug = `${stem || 'shop'}-${id.toLowerCase()}`;
  }
  if (slug.length > 120 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) issues.push({ path: 'slug', message: 'Use up to 120 lowercase letters, numbers and single hyphens.' });
  if (issues.length) throw new ShopValidationError(issues);
  return { name, slug };
}
