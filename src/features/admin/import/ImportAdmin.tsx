'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccountSession } from '@/src/features/account/AccountSessionProvider';
import { SearchSelect } from '../SearchSelect';
import { decodeOptions, type Options } from '../shop-contract';
import { readAdminResponse } from '../read-response';
import { BATCH_SIZE, FIELDS, MAX_BYTES, VERSION, type ColumnMap, type MappedRow, type PreviewRow, type Upload, type ValueMap } from './contract';
import { csvReport, defaultColumns, parseFile, safeCsvCell } from './parse';
import { mapRows, projectRows, vocabularyGroups, vocabularyOptions } from './mapping';
import styles from './ImportAdmin.module.css';
import { PrivateImport } from './PrivateImport';

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const templateColumns = ['row_id', 'shop_id', 'name', 'slug', 'country', 'locality', 'shop_type', 'brands', 'specialties', 'address_line_1', 'postal_code', 'timezone', 'latitude', 'longitude', 'website_url', 'short_description', 'clear_fields'];
const actionLabel: Record<PreviewRow['action'], string> = { new_private_draft: 'Proposed new private draft', update_private_draft: 'Proposed private update', no_change: 'No changes', review_duplicates: 'Review duplicate candidates', blocked: 'Needs correction' };
async function api(signal: AbortSignal, payload?: unknown) {
  const response = await fetch('/api/v1/admin/import', { method: payload ? 'POST' : 'GET', signal, cache: 'no-store', credentials: 'same-origin', ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}) });
  const data = await readAdminResponse(response, false);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new AccessError('Bulk preview requires a signed-in admin account.');
    throw Error(data.message || 'Preview is unavailable. Your file and mappings are still here. Retry the preview.');
  }
  return data;
}
class AccessError extends Error {}
export function ImportAdmin() {
  const { session } = useAccountSession();
  if (session.status !== 'signed-in') return <div className={styles.main}><h1>Bulk shop preview</h1><p>Sign in with your admin account to preview an import.</p><Link href="/me">Go to Me</Link></div>;
  return <ImportWorkspace key={session.userId} />;
}
function ImportWorkspace() {
  const [options, setOptions] = useState<Options | null>(null), [denied, setDenied] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null), [columns, setColumns] = useState<ColumnMap>({}), [values, setValues] = useState<ValueMap>({});
  const [selectedFilename, setSelectedFilename] = useState('');
  const [results, setResults] = useState<PreviewRow[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('Loading catalogue choices…');
  const [filter, setFilter] = useState('all'), [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const [resumedRows, setResumedRows] = useState<MappedRow[] | null>(null);
  const [batchId, setBatchId] = useState('');
  const controller = useRef<AbortController | null>(null), generation = useRef(0);
  const load = () => {
    const c = new AbortController(); controller.current?.abort(); controller.current = c;
    void api(c.signal).then(d => { if (!c.signal.aborted) { setOptions(decodeOptions(d.options)); setMessage(''); } }).catch(e => { if (!c.signal.aborted) { setDenied(e instanceof AccessError); setMessage(e.message); } });
  };
  useEffect(() => { load(); return () => { controller.current?.abort(); }; }, []);
  const projected = useMemo(() => { try { return { rows: upload ? projectRows(upload.rows, columns) : [], error: '' }; } catch (e) { return { rows: [], error: (e as Error).message }; } }, [upload, columns]);
  const groups = useMemo(() => options ? vocabularyGroups(projected.rows, options, values) : [], [projected, options, values]);
  const mapped = useMemo(() => resumedRows ?? (options ? mapRows(projected.rows, options, values) : []), [projected, options, values, resumedRows]);
  const unresolved = groups.filter(g => !g.resolved).length;
  const invalidate = () => { generation.current++; controller.current?.abort(); setResults([]); setPage(0); setMessage('Inputs changed. Run preview again.'); };
  async function select(file: File | undefined) {
    if (!file) return;
    invalidate(); setUpload(null); setSelectedFilename(''); setColumns({}); setResumedRows(null);
    const current = generation.current;
    try {
      if (file.size > MAX_BYTES) throw Error('Use a file no larger than 2 MiB.');
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : file.name.toLowerCase().endsWith('.json') ? 'json' : null;
      if (!format) throw Error('Choose a .csv or .json file.');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const parsed = parseFile(text, format);
      if (current !== generation.current) return;
      if (!batchId) setBatchId(crypto.randomUUID()); setUpload(parsed); setSelectedFilename(file.name); setColumns(defaultColumns(parsed.columns)); setMessage(`${parsed.rows.length} rows loaded. Check columns and resolve vocabulary once per distinct value.`);
    } catch (e) { if (current === generation.current) setMessage((e as Error).message); }
  }
  async function preview() {
    const c = new AbortController(); controller.current?.abort(); controller.current = c;
    const current = ++generation.current; setBusy(true); setResults([]); setPage(0);
    const completed: PreviewRow[] = [];
    try {
      // Bounded sequential requests; no concurrent storm and no catalogue writes.
      for (let i = 0; i < mapped.length;) {
        const chunk: MappedRow[] = [];
        while (i < mapped.length && chunk.length < BATCH_SIZE) {
          const row = mapped[i]!;
          if (row.issues.length) {
            completed.push({ rowId: row.rowId, line: row.line, name: row.cells.name || '', targetId: null, revision: null, action: 'blocked', issues: row.issues, candidates: [], fileDuplicates: row.fileDuplicates, changes: [], publicationErrors: [], hasPrivateChanges: false }); i++; continue;
          }
          const candidate = [...chunk, row];
          if (new TextEncoder().encode(JSON.stringify({ version: VERSION, batchId: batchId, rows: candidate })).length > 250000) { if (!chunk.length) throw Error(`Row ${row.rowId} is too large. Shorten the cells or split relationship values.`); break; }
          chunk.push(row); i++;
        }
        if (chunk.length) {
          const response = await api(c.signal, { version: VERSION, batchId: batchId, rows: chunk });
          if (current !== generation.current) return;
          if (response.version !== VERSION || !Array.isArray(response.rows) || response.rows.length !== chunk.length) throw Error('Invalid preview response. Retry.');
          completed.push(...response.rows);
        }
        setMessage(`Checked ${i} of ${mapped.length} rows. Nothing has been saved.`);
      }
      if (current !== generation.current) return;
      completed.sort((a, b) => a.line - b.line); setResults(completed); setMessage(`Preview complete: ${completed.length} rows checked. Nothing has been saved or published.`);
    } catch (e) {
      if (!c.signal.aborted) {
        if (e instanceof AccessError) { setDenied(true); setOptions(null); setUpload(null); setSelectedFilename(''); setValues({}); }
        setMessage((e as Error).message); setResults([]);
      }
    } finally { if (current === generation.current) setBusy(false); }
  }
  const visible = results.filter(r => (filter === 'all' || r.action === filter) && `${r.rowId} ${r.name} ${r.line}`.toLowerCase().includes(query.toLowerCase()));
  return <div className={styles.main}>
    <Link href="/admin/shops">← Shop administration</Link>
    <header><p className={styles.eyebrow}>BULK ONBOARDING · PRIVATE DRAFTS</p><h1>Prepare your shop catalogue</h1><p>Upload a spreadsheet once, map shared values, then review the changes and corrections. Preview is read-only. Select and confirm rows separately to save private drafts; nothing is published.</p></header>
    <p role="status" aria-live="polite">{message}</p>
    {!options && !denied && <button onClick={load}>Retry loading choices</button>}
    {options && !denied && <>
      <section aria-labelledby="file-heading"><h2 id="file-heading">1. Choose your file</h2>
        <div className={styles.actions}><button disabled={busy} onClick={() => download(`${VERSION}.csv`, [templateColumns, templateColumns.map(k => k === 'row_id' ? 'shop-001' : '')].map(r => r.map(safeCsvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')}>Download CSV template v1</button>
          <button disabled={busy} onClick={() => download(`${VERSION}.json`, JSON.stringify({ version: VERSION, rows: [Object.fromEntries(templateColumns.map(k => [k, k === 'row_id' ? 'shop-001' : '']))] }, null, 2), 'application/json')}>Download JSON template v1</button></div>
        <details><summary>Field instructions and update rules</summary><ul>
          <li>UTF-8 CSV or versioned JSON, up to 2 MiB, 500 rows and 64 columns. A typical 200-shop file is supported. Text cells keep leading zeroes.</li>
          <li>Keep a unique row_id such as shop-001 to identify corrections. shop_id is an exact existing UUID for proposed updates; blank means a proposed new shop. Names and slugs never authorize overwrites.</li>
          <li>New shops need a name. A blank slug gets a stable proposal during this preview session. Existing slugs cannot change here.</li>
          <li>Use | between brands or specialties. Resolve country, locality and shop type using existing choices. Missing choices remain unresolved; this step creates no vocabulary.</li>
          <li>Blank or omitted cells preserve existing data. Supplied brands/specialties are added without removing old links or notes. Shop type selects the primary type while keeping other types.</li>
          <li>To deliberately remove a value, put its field name in clear_fields, separated by |, and leave the value blank. Clearing brands, specialties or shop_type removes that whole relationship group and its notes; review the before/after carefully.</li>
          <li>Coordinates are decimal latitude/longitude; supply both. Appointment uses true/false; timezone uses an IANA name. Country and locality must agree. No confirmation or verification dates are inferred.</li>
          <li>Only mapped fields are considered. Media URLs, opening-hour structures, sources, aliases and experiences cannot be imported in v1; existing values remain intact.</li>
          <li>Correct the source file and reselect it to check again. Vocabulary mappings are reused during this signed-in session. Only reviewed rows are retained privately for recovery; raw files are not uploaded or retained.</li>
        </ul></details>
        <label className={`${styles.field} ${styles.filePicker}`}>CSV or JSON file
          <span className={styles.fileSelection}><span className={styles.fileButton}>Choose file</span><span id="selected-import-file" className={styles.fileName} aria-live="polite">{selectedFilename || 'No file chosen'}</span></span>
          <input className={styles.fileInput} type="file" accept=".csv,.json" aria-label="CSV or JSON file" aria-describedby="selected-import-file" disabled={busy} onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </section>
      {upload && <><section aria-labelledby="columns-heading"><h2 id="columns-heading">2. Match your columns</h2><p>{upload.rows.length} rows · {upload.columns.length} columns. Ignored columns will not be included.</p>
        <div className={styles.grid}>{upload.columns.map((column, index) => <div className={styles.field} key={column}><label htmlFor={`column-${index}`}>{column}</label><select id={`column-${index}`} disabled={busy} value={columns[column] ?? ''} onChange={e => { invalidate(); setColumns({ ...columns, [column]: e.target.value }); }}><option value="">Ignore this column</option>{FIELDS.map(f => <option key={f} value={f}>{f}</option>)}</select><small>Example: {upload.rows.find(r => r.cells[column])?.cells[column]?.slice(0, 70) || '(blank)'}</small></div>)}</div>
        {projected.error && <p role="alert">{projected.error}</p>}
      </section><section aria-labelledby="values-heading"><h2 id="values-heading">3. Resolve shared values</h2><p>{groups.length} distinct values · {unresolved} unresolved. One mapping applies to every matching row. Resolve countries before localities.</p>
        <div className={styles.grid}>{groups.map(g => { const choices = vocabularyOptions(g.kind, options, g.country); return <div key={g.key} className={styles.mapping}><SearchSelect label={`${g.kind}: ${g.raw} (${g.count} rows)`} path={g.key} value={g.resolved ?? ''} valueLabel={choices.find(c => c.id === g.resolved)?.label ?? ''} search={q => choices.filter(c => `${c.label} ${c.id}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60)} onChange={id => { invalidate(); setValues({ ...values, [g.key]: id ?? '' }); }} listLabel={`Existing ${g.kind} choices`} placeholder="Find an existing choice" clearLabel="Leave unresolved" disabled={busy} error={g.resolved ? undefined : 'Choose a canonical value; missing or ambiguous matches need review.'} /><small>{g.country && `Country: ${g.country}. `}{!choices.length && 'No matching choices exist. Correct the source or prepare the vocabulary separately.'}</small></div>; })}</div>
      </section><section aria-labelledby="preview-heading"><h2 id="preview-heading">4. Check the proposed changes</h2><p>Validation checks draft fields and reports publication requirements separately. Every proposal needs a fresh review before import.</p><button disabled={busy || !!projected.error || !mapped.length} onClick={() => void preview()}>{busy ? 'Checking rows…' : 'Run dry-run preview'}</button></section></>}
      {resumedRows && <section><h2>Continue reopened batch</h2><p>{resumedRows.length} unresolved rows loaded. Run a fresh preview, or load corrections with the same row IDs.</p><button disabled={busy || !resumedRows.length} onClick={() => void preview()}>Run dry-run preview</button></section>}
      {!!results.length && <section aria-labelledby="results-heading"><h2 id="results-heading">Preview results</h2><div className={styles.totals}>{Object.entries(actionLabel).map(([action, label]) => <span key={action}><strong>{results.filter(r => r.action === action).length}</strong> {label}</span>)}</div>
        <div className={styles.actions}><button onClick={() => download(`${VERSION}-corrections.csv`, csvReport(results), 'text/csv;charset=utf-8')}>Download correction report</button><div><label htmlFor="import-filter">Show</label><select id="import-filter" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="all">All rows</option>{Object.entries(actionLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div><div><label htmlFor="import-search">Find row or shop</label><input id="import-search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></div></div>
        <p>{visible.length} matching rows · page {page + 1} of {Math.max(1, Math.ceil(visible.length / 25))}</p>
        {visible.slice(page * 25, (page + 1) * 25).map((r, index) => <details key={`${r.rowId}-${index}`} className={styles.row}><summary><strong>{r.name || '(name missing)'}</strong><span>{r.rowId} · source line/row {r.line}</span><span>{actionLabel[r.action]}</span></summary>
          {r.targetId && <p>Existing shop: <Link href={`/admin/shops/${r.targetId}`}>{r.targetId}</Link>. {r.hasPrivateChanges ? 'The proposal preserves and builds on the existing private working copy.' : 'The proposal starts from the current catalogue revision.'}</p>}
          {!!r.issues.length && <ul>{r.issues.map((issue, i) => <li key={i}><strong>{issue.path}:</strong> {issue.message}</li>)}</ul>}
          {!!r.fileDuplicates.length && <p>Similar or repeated rows in this file: {r.fileDuplicates.join(', ')}. Resolve them in the source before importing.</p>}
          {!!r.candidates.length && <ul>{r.candidates.map(c => <li key={c.id}><Link href={`/admin/shops/${c.id}`}>{c.name}</Link> — {c.reason}. ID: {c.id}</li>)}</ul>}
          {!!r.changes.length && <><h3>Before → proposed after</h3><dl>{r.changes.map(change => <div key={change.field} className={styles.change}><dt>{change.field}{change.clear ? ' · EXPLICIT CLEAR' : ''}</dt><dd><pre>{JSON.stringify(change.before, null, 2)}</pre><span>→</span><pre>{JSON.stringify(change.after, null, 2)}</pre></dd></div>)}</dl></>}
          {!!r.publicationErrors.length && <><h3>Before publication, later</h3><ul>{r.publicationErrors.map(e => <li key={e}>{e}</li>)}</ul></>}
          <p>Correct this row in the source file, reselect it, and rerun preview. Eligible rows can be selected below.</p>
        </details>)}
        <div className={styles.actions}><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous rows</button><button disabled={(page + 1) * 25 >= visible.length} onClick={() => setPage(page + 1)}>Next rows</button></div>
      </section>}
      <PrivateImport blocked={busy} onBusyChange={setBusy} batchId={batchId} rows={mapped} previews={results} onResume={saved => {
        invalidate(); setBatchId(saved.id); setUpload(null); setSelectedFilename(''); setColumns({});
        setResumedRows(saved.operations.filter(o => o.status !== 'imported' && o.status !== 'skipped' && o.patch).map(o => o.patch!));
        setMessage('Batch reopened. Completed outcomes are retained. Preview unresolved rows before making corrections.');
      }} />
      <button disabled={busy} onClick={() => { invalidate(); setBatchId(''); setUpload(null); setSelectedFilename(''); setColumns({}); setResumedRows(null); }}>Start a separate new batch</button>
    </>}
  </div>;
}
