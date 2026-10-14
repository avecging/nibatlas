import { describe, expect, it } from 'vitest';
import { prepareRow } from './prepare';
import { FIELDS, MAX_COLUMNS, VERSION } from './contract';
import { defaultColumns, parseFile } from './parse';
import { mapRows, projectRows } from './mapping';
import { document, type ShopRecord } from '../shop-contract';
const id = 'a2000000-0000-4000-8000-000000000001';
const otherId = 'a2000000-0000-4000-8000-000000000002';
const record = (): ShopRecord => ({id, revision: 'a'.repeat(32), publicationStatus: 'published', hasChanges: false, publicationErrors: [], document: document({shop: {name: 'Synthetic', slug: 'synthetic', source_quality: 'demo', operational_status: 'unknown', position_precision: 'street'}, sources: [], aliases: [{id, alias: '旧店名', language_tag: 'ja-JP', alias_type: 'local_name'}, {id: otherId, alias: ' Legacy synonym ', language_tag: 'en', alias_type: 'search_synonym'}], links: [], types: [], brands: [], specialties: [], services: [], experiences: []})});
const prepare = (cells: Record<string, string>, target: ShopRecord | null = null, proposedId = id) => prepareRow({rowId: 'one', line: 2, cells, issues: [], fileDuplicates: []}, {rowId: 'one', record: target, candidates: [], truncated: false, conflict: false}, {}, proposedId);

describe('local-name import', () => {
  it('accepts Unicode names through CSV and JSON mapping with deterministic identities', () => {
    expect(FIELDS.length).toBeLessThanOrEqual(MAX_COLUMNS);
    for (const format of ['csv', 'json'] as const) {
      const cells = {name: 'Synthetic', local_name: '文具, "試験店"', local_name_language: 'zh-Hant'};
      const upload = parseFile(format === 'csv' ? 'name,local_name,local_name_language\nSynthetic,"文具, ""試験店""",zh-Hant' : JSON.stringify({version: VERSION, rows: [cells]}), format);
      const rows = mapRows(projectRows(upload.rows, defaultColumns(upload.columns)), {}, {});
      const result = prepare(rows[0]!.cells);
      expect(result.preview.issues).toEqual([]);
      expect(result.document?.aliases).toEqual([{id: expect.any(String), alias: cells.local_name, language_tag: 'zh-Hant', alias_type: 'local_name'}]);
      expect(prepare(rows[0]!.cells).document).toEqual(result.document);
      expect(prepare(rows[0]!.cells, null, otherId).document?.aliases[0]?.id).not.toBe(result.document?.aliases[0]?.id);
    }
  });
  it('preserves omitted/blank aliases exactly and never splits a combined main name', () => {
    const target = record();
    for (const cells of [{}, {local_name: ' ', local_name_language: ''}, {name: 'English 中文'}]) {
      expect(prepare(cells, target).document?.aliases).toEqual(target.document.aliases);
    }
    expect(prepare({}, target).preview.action).toBe('no_change');
    expect(prepare({name: 'English 中文'}).document?.aliases).toEqual([]);
  });
  it('updates one local name in place, keeps other aliases and shows readable before/after', () => {
    const target = record(), untouched = structuredClone(target);
    const result = prepare({local_name: ' 新店名 ', local_name_language: ' ja-JP '}, target);
    expect(result.preview.action).toBe('update_private_draft');
    expect(result.document?.aliases).toEqual([{...target.document.aliases[0], alias: '新店名'}, target.document.aliases[1]]);
    expect(result.preview.changes).toEqual([{field: 'local_name', before: ['旧店名'], after: ['新店名'], clear: false}]);
    expect(target).toEqual(untouched);
    expect(prepare({local_name: '新店名', local_name_language: 'ja-JP'}, {...target, document: result.document!}).preview.action).toBe('no_change');
  });
  it('adds a local name to an existing shop without touching other aliases', () => {
    const target = record(); target.document.aliases.shift();
    const cells = {local_name: '試験店', local_name_language: 'ja'};
    const result = prepare(cells, target);
    expect(result.preview.action).toBe('update_private_draft');
    expect(result.document?.aliases[0]).toEqual(target.document.aliases[0]);
    expect(result.document?.aliases[1]).toMatchObject({alias_type: 'local_name', alias: '試験店', language_tag: 'ja'});
    expect(prepare(cells, target, otherId).document).toEqual(result.document);
  });
  it.each([
    [{local_name: '試験店'}, 'local_name_language'],
    [{local_name_language: 'ja-JP'}, 'local_name'],
    [{local_name: '試験店', local_name_language: 'ja_JP'}, 'local_name_language'],
    [{local_name: '試験店', local_name_language: 'ja JP'}, 'local_name_language'],
    [{clear_fields: 'local_name', local_name: '試験店'}, 'local_name'],
    [{clear_fields: 'local_name', local_name_language: 'ja'}, 'local_name_language'],
    [{clear_fields: 'local_name_language'}, 'clear_fields'],
  ])('blocks invalid or contradictory input %j with the CSV column in its error', (cells, path) => {
    for (const target of [null, record()]) {
      const result = prepare({name: 'Synthetic', country: 'JP', ...cells}, target);
      expect(result.preview.action).toBe('blocked');
      expect(result.document).toBeNull();
      expect(result.preview.issues).toEqual(expect.arrayContaining([expect.objectContaining({path})]));
    }
  });
  it('refuses to guess among multiple local names and clears only local names explicitly', () => {
    const target = record();
    target.document.aliases.push({id: 'a2000000-0000-4000-8000-000000000003', alias: '別名', language_tag: 'ja', alias_type: 'local_name'});
    expect(prepare({local_name: '新店名', local_name_language: 'ja'}, target).preview.issues).toContainEqual({path: 'local_name', message: 'Multiple local names exist. Resolve them in the editor first.'});
    expect(prepare({name: 'Renamed'}, target).document?.aliases).toEqual(target.document.aliases);
    const cleared = prepare({clear_fields: 'local_name'}, target);
    expect(cleared.document?.aliases).toEqual([target.document.aliases[1]]);
    expect(cleared.preview.changes).toEqual([
      {field: 'local_name', before: ['旧店名', '別名'], after: [], clear: true},
      {field: 'local_name_language', before: ['ja-JP', 'ja'], after: [], clear: true},
    ]);
  });
});
