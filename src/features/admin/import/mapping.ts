import { countryChoices } from '../countries';
import type { Options, Option } from '../shop-contract';
import { FIELDS, VOCABULARIES, type ColumnMap, type InputRow, type MappedRow, type ValueMap, type Vocabulary } from './contract';
const comparable = (s: string) => s.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
export const mappingKey = (kind: Vocabulary, raw: string, country = '') => JSON.stringify([kind, country, raw.trim()]);
export function vocabularyOptions(kind: Vocabulary, options: Options, country = ''): Option[] {
  if (kind === 'country') return countryChoices().map(c => ({ id: c.code, label: c.name }));
  const choices = options[{ locality: 'localities', shop_type: 'types', brands: 'brands', specialties: 'specialties' }[kind]] ?? [];
  return kind === 'locality' && country ? choices.filter(c => c.countryCode === country) : choices;
}
export function resolveValue(kind: Vocabulary, raw: string, options: Options, values: ValueMap, country = ''): string | null {
  const choices = vocabularyOptions(kind, options, country), explicit = values[mappingKey(kind, raw, country)];
  if (explicit !== undefined) return choices.some(c => c.id === explicit) ? explicit : null;
  const matches = choices.filter(c => comparable(c.id) === comparable(raw) || comparable(c.label) === comparable(raw) || (kind === 'locality' && comparable(c.label.replace(/ \([A-Z]{2}\)$/, '')) === comparable(raw)));
  return matches.length === 1 ? matches[0]!.id : null;
}
export function projectRows(rows: InputRow[], columns: ColumnMap): InputRow[] {
  const selected = Object.values(columns).filter(Boolean);
  if (selected.some(c => !FIELDS.includes(c)) || new Set(selected).size !== selected.length) throw Error('Map each destination field only once.');
  return rows.map(row => {
    const cells = Object.fromEntries(Object.entries(columns).filter(([, target]) => target).map(([source, target]) => [target, row.cells[source] ?? '']));
    return { ...row, cells, rowId: cells.row_id?.trim() || row.rowId };
  });
}
export function vocabularyGroups(rows: InputRow[], options: Options, values: ValueMap) {
  const groups = new Map<string, { key: string; kind: Vocabulary; raw: string; country: string; count: number; resolved: string | null }>();
  for (const row of rows) {
    const country = resolveValue('country', row.cells.country ?? '', options, values) ?? '';
    for (const kind of VOCABULARIES) {
      const rawValues = ['brands', 'specialties'].includes(kind) ? (row.cells[kind] ?? '').split('|') : [row.cells[kind] ?? ''];
      for (const value of rawValues) {
        const raw = value.trim(); if (!raw) continue;
        const scope = kind === 'locality' ? country : '', key = mappingKey(kind, raw, scope), old = groups.get(key);
        groups.set(key, { key, kind, raw, country: scope, count: (old?.count ?? 0) + 1, resolved: resolveValue(kind, raw, options, values, scope) });
      }
    }
  }
  return [...groups.values()];
}
export function mapRows(rows: InputRow[], options: Options, values: ValueMap): MappedRow[] {
  const mapped: MappedRow[] = rows.map(row => {
    const cells = { ...row.cells }, issues: MappedRow['issues'] = [];
    const country = resolveValue('country', cells.country ?? '', options, values) ?? '';
    for (const kind of VOCABULARIES) {
      if (!cells[kind]?.trim()) continue;
      const rawValues = ['brands', 'specialties'].includes(kind) ? cells[kind]!.split('|') : [cells[kind]!];
      const ids = rawValues.filter(v => v.trim()).map(raw => resolveValue(kind, raw, options, values, kind === 'locality' ? country : ''));
      if (!ids.length || ids.some(id => !id)) issues.push({ path: kind, message: 'Resolve this vocabulary value in the grouped mapping above. Nothing will be created automatically.' });
      else cells[kind] = [...new Set(ids)].join('|');
    }
    return { ...row, cells, issues, fileDuplicates: [] };
  });
  for (const row of mapped) {
    if (!/^[\p{L}\p{N}_.:-]{1,100}$/u.test(row.rowId)) row.issues.push({ path: 'row_id', message: 'Use 1–100 letters, numbers, dots, hyphens, colons or underscores.' });
    if (mapped.some(other => other !== row && other.rowId === row.rowId)) row.issues.push({ path: 'row_id', message: 'Use a unique stable row ID for each row.' });
    row.fileDuplicates = mapped.filter(other => other !== row && (
      (row.cells.shop_id?.trim() && comparable(row.cells.shop_id) === comparable(other.cells.shop_id ?? '')) ||
      (row.cells.slug?.trim() && comparable(row.cells.slug) === comparable(other.cells.slug ?? '')) ||
      (row.cells.name?.trim() && comparable(row.cells.name) === comparable(other.cells.name ?? '') && (!row.cells.country?.trim() || !other.cells.country?.trim() || comparable(row.cells.country) === comparable(other.cells.country)))
    )).map(other => `${other.rowId} (line ${other.line})`);
  }
  return mapped;
}
