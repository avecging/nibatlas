import { expect, it } from 'vitest';
import { correctionCsv, decodeCorrection, mergeCorrections, sameCells, selectable, status, type JobRow } from './job';
import { FIELDS, MAX_COLUMNS, VERSION } from './contract';
import { defaultColumns, parseFile } from './parse';
import { mapRows, projectRows } from './mapping';
const row = (rowId: string, cells: Record<string, string>): JobRow => ({ input: { rowId, line: 2, cells, issues: [{ path: 'name', message: 'Supply a name.' }], fileDuplicates: [] } });
it('exports original fields with exact instructions, BOM, stable IDs and reversible formula protection', () => {
  const input = row('one', { name: '=HYPERLINK("https://example.test")', local_name: '試験店', latitude: '-33.2', longitude: '0', phone: '+6512345678', short_description: "'=literal", postal_code: '00123' });
  const csv = correctionCsv([input]);
  expect(csv.startsWith('\uFEFF')).toBe(true); expect(csv).toContain('name: Supply a name.'); expect(csv).toContain('Keep row_id unchanged');
  expect(csv).toContain("\"'=HYPERLINK");
  const parsed = parseFile(csv, 'csv'); expect(parsed.columns.length).toBeLessThanOrEqual(MAX_COLUMNS);
  const decoded = projectRows(parsed.rows.map(decodeCorrection), defaultColumns(parsed.columns))[0]!;
  for (const [field, value] of Object.entries(input.input.cells)) expect(decoded.cells[field]).toBe(value);
  expect(decoded.rowId).toBe('one'); expect(parsed.columns).toEqual([...FIELDS, 'correction_format', 'errors', 'how_to_fix']);
});
it('a 500-row duplicate-heavy correction report can be reuploaded', () => {
  const input = Array.from({ length: 500 }, (_, i) => ({ rowId: `row-${i}`, line: i + 2, cells: { name: 'Duplicate' } }));
  const rows = mapRows(input, {}, {}).map(input => ({ input }));
  const csv = correctionCsv(rows); expect(new TextEncoder().encode(csv).length).toBeLessThan(2 * 1024 * 1024);
  expect(parseFile(csv, 'csv').rows).toHaveLength(500);
});
it('only named corrections change and unknown or repeated row IDs cannot rebuild a job', () => {
  const existing = [row('one', { name: 'Original' }).input, row('two', { name: 'Keep' }).input];
  const correction = row('one', { row_id: 'one', name: 'Corrected' }).input;
  const merged = mergeCorrections(existing, [correction]);
  expect(merged[0]?.cells.name).toBe('Corrected'); expect(merged[1]).toBe(existing[1]);
  expect(() => mergeCorrections(existing, [{ ...correction, rowId: 'unknown' }])).toThrow(/Unknown/);
  expect(() => mergeCorrections(existing, [correction, correction])).toThrow(/Repeated/);
  expect(() => mergeCorrections(existing, [row('one', { name: 'Missing ID' }).input])).toThrow(/original row_id/);
});
it('normalizes coordinate headers without silently discarding them', () => {
  for (const keys of [['Latitude', 'Longitude'], ['lat', 'lng'], ['latitude', 'lon']]) {
    const parsed = parseFile(JSON.stringify({ version: VERSION, rows: [{ name: 'Synthetic', [keys[0]!]: -33.2, [keys[1]!]: 0 }] }), 'json');
    expect(projectRows(parsed.rows, defaultColumns(parsed.columns))[0]?.cells).toMatchObject({ latitude: '-33.2', longitude: '0' });
  }
});
it('invalid and duplicate rows are excluded even when a preview advertises eligibility', () => {
  const invalid = row('one', { name: 'Synthetic' });
  invalid.preview = { rowId: 'one', line: 2, name: 'Synthetic', targetId: null, revision: null, action: 'new_private_draft', reviewKey: 'a'.repeat(64), issues: [], candidates: [], fileDuplicates: [], changes: [], publicationErrors: [], hasPrivateChanges: false };
  expect(selectable(invalid)).toBe(false);
  invalid.input.issues = []; invalid.input.fileDuplicates = ['other'];
  expect(selectable(invalid)).toBe(false); expect(status(invalid)).toBe('Duplicate');
});

it('compares recovered JSONB cells independently of key order', () => {
  expect(sameCells({ row_id: 'one', name: 'Synthetic', latitude: '0' }, { latitude: '0', name: 'Synthetic', row_id: 'one' })).toBe(true);
  expect(sameCells({ name: 'Original' }, { name: 'Changed' })).toBe(false);
});
