import { eligible, FIELDS, MAX_ROWS, type ImportOperation, type InputRow, type MappedRow, type PreviewRow } from './contract';
import type { PublicationRow } from './publication-contract';
import { safeCsvCell } from './parse';

export type JobRow = {
  input: MappedRow; preview?: PreviewRow | undefined; operation?: ImportOperation | undefined;
  publication?: PublicationRow | undefined; failure?: string | undefined; correction?: boolean | undefined;
};
export type Filter = 'all' | 'ready' | 'fixing' | 'duplicates' | 'failed';
export const sameCells = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
export const published = (r: JobRow) => !r.correction && (r.publication?.publication?.status === 'published' || r.publication?.kind === 'already_published');
export const duplicate = (r: JobRow) => !!r.input.fileDuplicates.length || !!r.preview?.candidates.length || r.preview?.action === 'review_duplicates';
export const selectable = (r: JobRow) => !duplicate(r) && !published(r) && !r.input.issues.length &&
  (r.operation?.status === 'imported' && !r.correction ? r.publication?.canReview === true : !!r.preview && eligible(r.preview));
export function status(r: JobRow): string {
  if (duplicate(r)) return 'Duplicate';
  if (r.failure || r.operation?.status === 'failed' || r.operation?.status === 'conflicted' || r.publication?.publication?.status === 'failed' || r.publication?.conflict) return 'Failed';
  if (published(r)) return 'Published';
  if (r.operation?.status === 'imported' && !r.correction) return 'Draft saved';
  if (r.preview?.action === 'no_change') return 'No changes';
  if (r.input.issues.length || r.preview?.action === 'blocked') return 'Needs fixing';
  return r.preview ? 'Ready' : 'Checking';
}
export function matches(r: JobRow, filter: Filter) {
  return filter === 'all' || filter === 'ready' && selectable(r) && status(r) !== 'Failed' ||
    filter === 'fixing' && (status(r) === 'Needs fixing' || !!r.publication?.blockers.length) ||
    filter === 'duplicates' && duplicate(r) || filter === 'failed' && status(r) === 'Failed';
}
export function problems(r: JobRow): string[] {
  return [...new Set([
    ...(r.preview?.issues ?? r.input.issues).map(i => `${i.path.replace(/^shop\./, '')}: ${i.message}`),
    ...(r.input.fileDuplicates.length ? [`Possible duplicate of ${r.input.fileDuplicates.slice(0, 8).join(', ')}${r.input.fileDuplicates.length > 8 ? ` and ${r.input.fileDuplicates.length - 8} more rows with repeated name, slug or shop_id` : ''}.`] : []),
    ...(r.preview?.candidates ?? []).map(c => `Possible duplicate: ${c.name} (${c.id}) — ${c.reason}.`),
    ...(r.failure ? [r.failure] : []), ...(r.operation?.reason ? [r.operation.reason] : []),
    ...(r.publication?.blockers ?? []), ...(r.publication?.publication?.reason ? [r.publication.publication.reason] : []),
  ])];
}
export function guidance(r: JobRow): string {
  if (duplicate(r)) return 'Compare the listed shops. To update an existing shop, put its exact ID in shop_id. For repeated file rows, keep one target per row and correct the repeated name/slug/ID. Re-upload corrections with the same row_id.';
  if (r.operation?.status === 'imported') return 'Correct the named fields in this CSV and re-upload with the same row_id, or open the saved shop and refresh this job. Coordinates already saved do not need re-entry. Position confirmation is a separate check when publishing.';
  if (r.failure || r.operation?.reason) return 'Refresh this job to recover saved outcomes and check current data. Correct the listed fields in the correction CSV, keep row_id, re-upload, then retry selected rows.';
  return 'Correct the named fields using the error instructions. Keep row_id unchanged, save as UTF-8 CSV, and re-upload. Choose existing catalogue values in Column and value mapping where needed.';
}

/** Corrections replace named input rows, never rebuild/reorder the whole job. */
export function mergeCorrections(existing: InputRow[], corrections: InputRow[]) {
  const ids = new Set<string>();
  for (const row of corrections) {
    if (!row.cells.row_id?.trim()) throw Error('Every correction needs its original row_id. Download the correction CSV from this job.');
    if (ids.has(row.rowId)) throw Error(`Repeated row_id ${row.rowId}. Keep one correction per row.`);
    if (!existing.some(r => r.rowId === row.rowId)) throw Error(`Unknown row_id ${row.rowId}. Start a new job for new rows.`);
    ids.add(row.rowId);
  }
  if (existing.length > MAX_ROWS) throw Error('Use at most 500 rows.');
  const replacements = new Map(corrections.map(r => [r.rowId, r]));
  return existing.map(row => !replacements.has(row.rowId) ? row :
    { ...replacements.get(row.rowId)!, line: row.line });
}

const FORMAT = 'nibatlas-corrections-v1';
export function correctionCsv(rows: JobRow[]) {
  const headers = [...FIELDS, 'correction_format', 'errors', 'how_to_fix'];
  const cell = (value: string) => value.startsWith("'") ? safeCsvCell(`'${value}`) : safeCsvCell(value);
  return '\uFEFF' + [headers.map(safeCsvCell).join(','), ...rows.filter(r => problems(r).length).map(r => {
    const input: Record<string, string> = { ...r.input.cells, row_id: r.input.rowId };
    return [...FIELDS.map(f => cell(input[f] ?? '')), safeCsvCell(FORMAT), safeCsvCell(problems(r).join('\n').slice(0, 3500)), safeCsvCell(guidance(r))].join(',');
  })].join('\r\n');
}
/** Undo only our explicit report transport escaping, not ordinary source data. */
export function decodeCorrection(row: InputRow): InputRow {
  if (row.cells.correction_format !== FORMAT) return row;
  return { ...row, cells: Object.fromEntries(Object.entries(row.cells).map(([k, v]) => [k,
    FIELDS.includes(k) && /^'(?:'|[\s\u0000-\u001f]*[=+@-]|[\t\r\n])/.test(v) ? v.slice(1) : v])) };
}
