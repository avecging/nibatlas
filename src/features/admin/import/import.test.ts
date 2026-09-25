import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { document, type Options, type ShopRecord } from '../shop-contract';
import { VERSION, type Context } from './contract';
import { csvReport, defaultColumns, parseFile, safeCsvCell } from './parse';
import { mapRows, mappingKey, projectRows, vocabularyGroups } from './mapping';
import { prepareRow, proposedIdentity } from './prepare';
const id = '60000000-0000-4000-8000-000000000001';
const local = '60000000-0000-4000-8000-000000000002';
const brand = '60000000-0000-4000-8000-000000000003';
export const options: Options = { localities: [{ id: local, label: 'Synthetic City (SG)', countryCode: 'SG' }], types: [], brands: [{ id: brand, label: 'Synthetic Brand' }], specialties: [], services: [{ id, label: "Existing service" }] };
const context = (): Context => ({ rowId: 'one', record: null, candidates: [], truncated: false, conflict: false });
const parse = (rows: unknown[]) => { const upload = parseFile(JSON.stringify({ version: VERSION, rows }), 'json'); return projectRows(upload.rows, defaultColumns(upload.columns)); };
const record = (): ShopRecord => ({ id, revision: 'a'.repeat(32), publicationStatus: 'published', hasChanges: true, publicationErrors: [], document: document({ shop: { name: 'Synthetic old name', slug: 'keep-url', source_quality: 'sourced', operational_status: 'open', position_precision: 'street', country_code: 'SG', locality_id: local, website_url: 'https://example.test', postal_code: '00123', internal_notes: 'Private existing note' }, sources: [{ id, label: 'Existing official source', source_type: 'official', checked_at: '2026-01-01', reliability: 'primary', status: 'active', claims: ['Name'] }], aliases: [], links: [], experiences: [], services: [{ service_id: id, source_id: id, note: 'Preserved service' }], types: [], brands: [{ brand_id: brand, source_id: id, note: 'Legacy note' }], specialties: [] }) });
describe('bounded import file contract', () => {
  it('reads BOM, escaped quotes, multiline cells, Unicode and leading zeroes', () => {
    const upload = parseFile('\uFEFFname,postal_code,short_description\r\n"Synthetic, 文具",00123,"a ""quote""\nparagraph"\r\n', 'csv');
    expect(upload.rows[0]).toMatchObject({ line: 2, cells: { name: 'Synthetic, 文具', postal_code: '00123', short_description: 'a "quote"\nparagraph' } });
  });
  it.each(['name,name\na,b', 'name,\na,b', 'name,x\na', 'name\n"unterminated', 'name\nabc"d', 'name\n"a"x'])('rejects malformed CSV %s', csv => expect(() => parseFile(csv, 'csv')).toThrow());
  it('rejects large, over-column, over-row, nested, wrong-version and empty files', () => {
    expect(() => parseFile('x'.repeat(2097153), 'csv')).toThrow(/2 MiB/);
    expect(() => parseFile(Array.from({ length: 65 }, (_, i) => `c${i}`).join(',') + '\n' + ','.repeat(64), 'csv')).toThrow(/64/);
    expect(() => parseFile('name\n' + 'x\n'.repeat(501), 'csv')).toThrow(/500/);
    for (const value of [{ version: 'v99', rows: [{}] }, { version: VERSION, rows: [{ name: {} }] }, { version: VERSION, rows: [] }]) expect(() => parseFile(JSON.stringify(value), 'json')).toThrow();
  });
  it('uses explicit stable IDs and rejects colliding column mappings', () => {
    expect(parse([{ row_id: 'shop-001', name: 'One' }])[0]?.rowId).toBe('shop-001');
    expect(() => projectRows([], { first: 'name', second: 'name' })).toThrow(/only once/);
    expect(mapRows(parse([{ row_id: 'same', name: 'One' }, { row_id: 'same', name: 'Two' }]), options, {})[0]?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'row_id' })]));
  });
  it.each(['=SUM(A1)', '+cmd', '-cmd', '@cmd', '\t=cmd', '\r=cmd', '  =cmd', '\u0000=cmd'])('escapes spreadsheet formula %j', v => expect(safeCsvCell(v).startsWith('"\'')).toBe(true));
  it('keeps hostile column names as ordinary own properties', () => {
    const p = parseFile('__proto__,constructor,name\na,b,Safe\n', 'csv');
    expect(Object.hasOwn(p.rows[0]!.cells, '__proto__')).toBe(true);
    expect(projectRows(p.rows, defaultColumns(p.columns))[0]?.cells).toEqual({ name: 'Safe' });
  });
});
describe('mapping and safe merged previews', () => {
  it('maps canonical type codes and reviewed brand names without creating choices', () => {
    const canonical: Options = {
      localities: [{ id: local, label: 'Singapore (SG)', countryCode: 'SG' }],
      types: [
        { id, label: 'Fountain Pen Specialist', code: 'fountain_pen_specialist' },
        { id: '60000000-0000-4000-8000-000000000004', label: 'Stationery Store', code: 'stationery_store' },
        { id: '60000000-0000-4000-8000-000000000005', label: 'Nib / Repair Services', code: 'nib_repair_services' },
      ],
      brands: ['Waterman', 'LAMY', 'Graf von Faber-Castell', 'Faber-Castell', 'Kaweco']
        .map((label, index) => ({ id: `60000000-0000-4000-8000-0000000000${10 + index}`, label })),
      specialties: [], services: [],
    };
    const rows = parse([
      { row_id: 'sg-1', country: 'Singapore', locality: 'Singapore', shop_type: 'nib_repair_services', brands: 'Waterman' },
      { row_id: 'sg-2', country: 'SG', locality: 'Singapore', shop_type: 'fountain_pen_specialist', brands: 'Lamy|Graf von Faber-Castell' },
      { row_id: 'sg-3', country: 'SG', locality: 'Singapore', shop_type: 'stationery_store', brands: 'Faber-Castell|Kaweco' },
    ]);
    expect(vocabularyGroups(rows, canonical, {}).filter(group => !group.resolved)).toEqual([]);
    const mapped = mapRows(rows, canonical, {});
    expect(mapped.every(row => row.issues.length === 0 && row.cells.locality === local)).toBe(true);
    expect(mapped.map(row => row.cells.shop_type)).toEqual([canonical.types![2]!.id, canonical.types![0]!.id, canonical.types![1]!.id]);
    expect(mapped[1]!.cells.brands).toBe(`${canonical.brands![1]!.id}|${canonical.brands![2]!.id}`);
  });
  it('maps distinct ambiguous locality once and country-scopes it', () => {
    const ambiguous = { ...options, localities: [...options.localities!, { id, label: 'Synthetic City (SG)', countryCode: 'SG' }] };
    const rows = parse([{ name: 'One', country: 'Singapore', locality: 'Synthetic City' }, { name: 'Two', country: 'SG', locality: 'Synthetic City' }]);
    const groups = vocabularyGroups(rows, ambiguous, {});
    expect(groups.find(g => g.kind === 'locality')).toMatchObject({ count: 2, resolved: null });
    const values = { [mappingKey('locality', 'Synthetic City', 'SG')]: local };
    expect(mapRows(rows, ambiguous, values).every(r => r.cells.locality === local && !r.issues.length)).toBe(true);
    expect(mapRows(parse([{ country: 'JP', locality: 'Synthetic City' }]), ambiguous, values)[0]?.issues).toHaveLength(1);
  });
  it('preserves blank/omitted fields, provenance, URLs and relationship metadata on updates', () => {
    const base = record(), before = structuredClone(base);
    const row = mapRows(parse([{ shop_id: id, name: 'Renamed', website_url: '', brands: 'Synthetic Brand' }]), options, {})[0]!;
    const r = prepareRow(row, { ...context(), record: base }, options, id);
    expect(r.document?.shop).toMatchObject({ name: 'Renamed', slug: 'keep-url', postal_code: '00123', website_url: 'https://example.test', internal_notes: 'Private existing note' });
    expect(r.document?.sources).toEqual(base.document.sources); expect(r.document?.services).toEqual(base.document.services); expect(r.document?.brands).toEqual(base.document.brands);
    expect(base).toEqual(before); expect(r.preview.action).toBe('update_private_draft');
  });
  it('distinguishes explicit clears and blocks destructive slug changes, conflicts and unknown targets', () => {
    const row = mapRows(parse([{ shop_id: id, clear_fields: 'website_url|brands' }]), options, {})[0]!;
    const r = prepareRow(row, { ...context(), record: record() }, options, id);
    expect(r.document?.shop.website_url).toBeNull(); expect(r.document?.brands).toEqual([]);
    expect(r.preview.changes.filter(c => c.clear).map(c => c.field)).toEqual(['website_url', 'brands']);
    for (const cells of [{ shop_id: id, slug: 'different' }, { shop_id: id, clear_fields: 'website_url', website_url: 'https://example.test' }, { shop_id: id, clear_fields: 'sources' }]) expect(prepareRow(mapRows(parse([cells]), options, {})[0]!, { ...context(), record: record() }, options, id).preview.action).toBe('blocked');
    expect(prepareRow(row, { ...context(), record: record(), conflict: true }, options, id).preview.action).toBe('blocked');
    expect(prepareRow(row, context(), options, id).preview.action).toBe('blocked');
  });
  it('treats database/file name matches as candidates, never update authority', () => {
    const rows = mapRows(parse([{ name: 'One' }, { name: 'One' }]), options, {});
    const r = prepareRow(rows[0]!, { ...context(), candidates: [{ id, name: 'One', slug: 'one', reason: 'similar name' }] }, options, id);
    expect(r.preview.action).toBe('review_duplicates'); expect(r.preview.targetId).toBeNull(); expect(r.preview.fileDuplicates).toHaveLength(1);
  });
  it('flags duplicates when country is unknown and permits locality-only updates without losing the country', () => {
    const duplicates = mapRows(parse([{ name: 'Same', country: 'SG' }, { name: 'Same' }]), options, {});
    expect(duplicates.every(r => r.fileDuplicates.length === 1)).toBe(true);
    const row = mapRows(parse([{ shop_id: id, locality: local }]), options, {})[0]!;
    expect(row.issues).toEqual([]);
    expect(prepareRow(row, { ...context(), record: record() }, options, id).document?.shop.country_code).toBe('SG');
  });
  it('keeps untouched legacy whitespace byte-for-byte and reports a true no-op', () => {
    const base = record();
    base.document.sources[0]!.label = '  Official page  ';
    base.document.sources[0]!.claims = [' Name '];
    base.document.sources[0]!.evidence_note = '  private evidence  ';
    base.document.shop.internal_notes = '  private note  ';
    const row = mapRows(parse([{ shop_id: id }]), options, {})[0]!;
    const result = prepareRow(row, { ...context(), record: base }, options, id);
    expect(result.preview.action).toBe('no_change'); expect(result.preview.changes).toEqual([]);
    expect(result.document).toEqual(base.document);
  });
  it('keeps generated identities stable for retries and independent between batches/rows', async () => {
    const a = await proposedIdentity(id, 'row-one'); expect(a).toBe(await proposedIdentity(id, 'row-one'));
    expect(a).not.toBe(await proposedIdentity(local, 'row-one')); expect(a).not.toBe(await proposedIdentity(id, 'row-two'));
  });
  it('handles 200 mixed rows through parsing, grouped mapping and shared normalization', () => {
    const start = performance.now();
    const rows = Array.from({ length: 200 }, (_, i) => ({ row_id: `row-${i}`, name: i % 5 === 3 ? 'Synthetic duplicate' : `Synthetic ${i}`, country: 'SG', locality: i % 5 === 2 ? 'Unknown City' : 'Synthetic City', latitude: i % 5 === 1 ? '999' : '0', longitude: '0', postal_code: '00123', brands: 'Synthetic Brand' }));
    const mapped = mapRows(parse(rows), options, {});
    const results = mapped.map((row, i) => prepareRow(row, { ...context(), candidates: i % 5 === 4 ? [{ id, name: row.cells.name!, slug: 'candidate', reason: 'similar name' }] : [] }, options, id).preview);
    expect(results.filter(r => r.action === 'new_private_draft')).toHaveLength(40);
    expect(results.filter(r => r.action === 'blocked')).toHaveLength(80);
    expect(results.filter(r => r.action === 'review_duplicates')).toHaveLength(80);
    expect(results[0]!.changes.find(c => c.field === 'postal_code')?.after).toBe('00123');
    expect(csvReport(results).split('\r\n')).toHaveLength(201);
    expect(performance.now() - start).toBeLessThan(10000);
  });
});
