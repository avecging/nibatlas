import { FIELDS, MAX_BYTES, MAX_COLUMNS, MAX_ROWS, VERSION, type Cells, type Upload } from './contract';

export class ImportFileError extends Error {}
/** RFC 4180-style CSV including BOM, escaped quotes and multiline cells. No coercion. */
function csv(text: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = [];
  let cells: string[] = [], value = '', quoted = false, closed = false, line = 1, start = 1;
  const cell = () => { cells.push(value); value = ''; closed = false; if (cells.length > MAX_COLUMNS) throw new ImportFileError(`Use at most ${MAX_COLUMNS} columns.`); };
  const row = () => { cell(); if (cells.some(c => c.trim())) rows.push({ cells, line: start }); cells = []; if (rows.length > MAX_ROWS + 1) throw new ImportFileError(`Split the file into at most ${MAX_ROWS} rows.`); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else { value += c; if (c === '\n') line++; }
    } else if (c === ',') cell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row(); line++; start = line; }
    else if (c === '"' && value === '' && !closed) quoted = true;
    else if (closed || c === '"') throw new ImportFileError(`Line ${line}: misplaced quote. Quote the whole cell and double any quotes inside it.`);
    else value += c;
  }
  if (quoted) throw new ImportFileError(`Line ${start}: close the quoted cell.`);
  if (value || cells.length || closed) row();
  return rows;
}
export function parseFile(text: string, format: 'csv' | 'json'): Upload {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new ImportFileError('Use a file no larger than 2 MiB.');
  text = text.replace(/^\uFEFF/, '');
  let columns: string[], entries: { cells: Cells; line: number }[];
  if (format === 'csv') {
    const all = csv(text), header = all.shift();
    if (!header) throw new ImportFileError('Add a header row and at least one shop.');
    columns = header.cells.map(c => c.trim());
    if (columns.some(c => !c || c.length > 100) || new Set(columns).size !== columns.length)
      throw new ImportFileError('Give every column a unique, non-empty heading of at most 100 characters.');
    entries = all.map(r => {
      if (r.cells.length !== columns.length) throw new ImportFileError(`Line ${r.line}: expected ${columns.length} cells, received ${r.cells.length}. Check commas and quotes.`);
      return { cells: Object.fromEntries(columns.map((c, i) => [c, r.cells[i]!])), line: r.line };
    });
  } else {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new ImportFileError('Invalid JSON. Use the versioned template and check commas and quotes.'); }
    const wrapper = parsed as { version?: unknown; rows?: unknown } | null;
    if (!wrapper || Array.isArray(wrapper) || wrapper.version !== VERSION || !Array.isArray(wrapper.rows) || Object.keys(wrapper).some(k => !['version', 'rows'].includes(k)))
      throw new ImportFileError(`Use a JSON object with version "${VERSION}" and a rows array.`);
    const columnSet = new Set<string>();
    entries = wrapper.rows.map((raw: unknown, i: number) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ImportFileError(`Row ${i + 1}: use an object of named cells.`);
      const cells: Cells = Object.create(null);
      for (const [key, value] of Object.entries(raw)) {
        if (!key.trim() || key.length > 100) throw new ImportFileError(`Row ${i + 1}: use named fields of at most 100 characters.`);
        if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new ImportFileError(`Row ${i + 1}, ${key}: use a text, number, boolean or null cell; separate multiple vocabulary values with |.`);
        columnSet.add(key); cells[key] = value == null ? '' : String(value);
      }
      return { cells, line: i + 1 };
    });
    columns = [...columnSet];
  }
  if (!entries.length || entries.length > MAX_ROWS || columns.length > MAX_COLUMNS) throw new ImportFileError(`Use 1–${MAX_ROWS} rows and at most ${MAX_COLUMNS} columns.`);
  if (entries.some(e => Object.values(e.cells).some(v => v.length > 4000))) throw new ImportFileError('Use at most 4,000 characters per cell.');
  // Identities are bound to source positions until an explicit row_id mapping is applied.
  return { version: VERSION, columns, rows: entries.map(e => ({ ...e, rowId: `line-${e.line}` })) };
}
export function defaultColumns(columns: string[]) {
  return Object.fromEntries(columns.map(c => [c, FIELDS.includes(c) ? c : '']));
}
export function safeCsvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function csvReport(rows: import('./contract').PreviewRow[]): string {
  return [['row_id', 'source_line', 'name', 'intended_action', 'errors', 'duplicates', 'publication_requirements'], ...rows.map(r => [r.rowId, r.line, r.name, r.action, r.issues.map(i => `${i.path}: ${i.message}`).join('\n'), [...r.fileDuplicates, ...r.candidates.map(c => `${c.id}: ${c.name} (${c.reason})`)].join('\n'), r.publicationErrors.join('\n')])].map(r => r.map(safeCsvCell).join(',')).join('\r\n');
}
