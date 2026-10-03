'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAccountSession } from '@/src/features/account/AccountSessionProvider';
import { UploadField } from '../UploadField';
import { SearchSelect } from '../SearchSelect';
import { decodeOptions, type Options } from '../shop-contract';
import { FIELDS, MAX_REPORT_BYTES, VERSION, type BatchSummary, type ColumnMap, type InputRow, type Upload, type ValueMap } from './contract';
import { defaultColumns, parseFile, safeCsvCell } from './parse';
import { mapRows, projectRows, vocabularyGroups, vocabularyOptions } from './mapping';
import { correctionCsv, decodeCorrection, guidance, matches, mergeCorrections, problems, published, sameCells, selectable, status, type Filter, type JobRow } from './job';
import { actOnRow, ImportAccessError, importRequest, listJobs, previewRows, publicationRows, readJob } from './job-api';
import styles from './ImportAdmin.module.css';

function download(filename: string, contents: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const filters: [Filter, string][] = [['all', 'All'], ['ready', 'Ready'], ['fixing', 'Needs fixing'], ['duplicates', 'Duplicates'], ['failed', 'Failed']];
export function ImportAdmin() {
  const { session } = useAccountSession();
  if (session.status !== 'signed-in') return <div className={styles.main}><h1>Bulk shop importer</h1><p>Sign in with your admin account to import shops.</p><Link href="/me">Go to Me</Link></div>;
  return <ImportWorkspace key={session.userId} />;
}
function ImportWorkspace() {
  const [options, setOptions] = useState<Options | null>(null), [denied, setDenied] = useState(false);
  const [sources, setSources] = useState<InputRow[]>([]), [rows, setRows] = useState<JobRow[]>([]);
  const [upload, setUpload] = useState<Upload | null>(null), [columns, setColumns] = useState<ColumnMap>({}), [values, setValues] = useState<ValueMap>({});
  const [filename, setFilename] = useState(''), [fileError, setFileError] = useState('');
  const [batchId, setBatchId] = useState(''), [jobs, setJobs] = useState<BatchSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set()), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading catalogue choices…'), [filter, setFilter] = useState<Filter>('all'), [query, setQuery] = useState('');
  const [exceptionsOnly, setExceptionsOnly] = useState(false), [completedAction, setCompletedAction] = useState<'draft' | 'publish'>('draft');
  const [mappingOpen, setMappingOpen] = useState(false), [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [publishDecision, setPublishDecision] = useState(false), [positionsChecked, setPositionsChecked] = useState(false);
  const controller = useRef<AbortController | null>(null), ids = useRef(new Map<string, string>());
  const begin = () => { controller.current?.abort(); const c = new AbortController(); controller.current = c; setBusy(true); setPublishDecision(false); setPositionsChecked(false); return c; };
  const failure = (error: unknown, signal: AbortSignal) => {
    if (signal.aborted) return;
    if (error instanceof ImportAccessError) { setDenied(true); setOptions(null); setRows([]); setSources([]); setUpload(null); setJobs([]); setSelected(new Set()); }
    setMessage((error as Error).message);
  };
  useEffect(() => {
    const c = new AbortController(); controller.current = c;
    void importRequest<{ options: unknown }>('', c.signal).then(d => {
      if (!c.signal.aborted) { setOptions(decodeOptions(d.options)); setMessage(''); }
    }).catch(e => failure(e, c.signal));
    void listJobs(c.signal).then(d => { if (!c.signal.aborted) setJobs(d); }).catch(() => {});
    return () => controller.current?.abort();
  }, []);
  const done = (row: JobRow) => completedAction === 'publish' ? published(row) : row.operation?.status === 'imported' && !row.correction || row.preview?.action === 'no_change';
  const groups = options ? vocabularyGroups(sources, options, values) : [];
  const chosen = rows.filter(r => selected.has(r.input.rowId) && selectable(r));
  const visible = rows.filter(r => matches(r, filter) && (!exceptionsOnly || !done(r) || !!r.failure) &&
    `${r.input.rowId} ${r.preview?.name ?? r.input.cells.name ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  async function validate(input: InputRow[], id: string, old: JobRow[], signal: AbortSignal, mapping = values, corrected = new Set<string>()) {
    if (!options) return;
    const targeted = input.map(source => {
      const previous = old.find(r => r.input.rowId === source.rowId);
      const bound = previous?.operation && (previous.operation.status === 'imported' || previous.correction || previous.input.cells.shop_id === previous.operation.target_id);
      if (bound && source.cells.shop_id?.trim() && source.cells.shop_id.trim() !== previous.operation!.target_id) throw Error(`Row ${source.rowId} is already linked to shop ${previous.operation!.target_id}. Keep that shop_id for corrections.`);
      return bound ? { ...source, cells: { ...source.cells, shop_id: previous.operation!.target_id } } : source;
    });
    setSources(targeted);
    const mapped = mapRows(targeted, options, mapping);
    const saved = new Map(old.filter(r => r.operation?.status === 'imported' && !r.correction && !corrected.has(r.input.rowId)).map(r => [r.input.rowId, r]));
    setRows(mapped.map(r => saved.get(r.rowId) ?? { input: r }));
    setSelected(new Set());
    const checked = await previewRows(mapped.filter(r => !saved.has(r.rowId)), id, signal);
    if (signal.aborted) return;
    const next = mapped.map(input => {
      if (saved.has(input.rowId)) return saved.get(input.rowId)!;
      const checkedRow = checked.find(r => r.input.rowId === input.rowId)!, previous = old.find(r => r.input.rowId === input.rowId);
      const correction = previous?.operation?.status === 'imported' && checkedRow.preview?.action !== 'no_change';
      return { ...checkedRow, operation: previous?.operation, correction,
        publication: correction ? undefined : previous?.publication };
    });
    setRows(next);
    setSelected(new Set(next.filter(r => selectable(r) && (corrected.has(r.input.rowId) || selected.has(r.input.rowId) || !old.some(o => o.input.rowId === r.input.rowId && selectable(o)))).map(r => r.input.rowId)));
    setMessage(`${next.length} rows checked · ${next.filter(selectable).length} ready`);
  }
  async function loadFile(file: File | undefined) {
    if (!file || !options) return;
    const c = begin(); setFilename(file.name); setFileError(''); setMessage('Reading file…');
    try {
      if (file.size > MAX_REPORT_BYTES) throw Error('Use a source file no larger than 2 MiB, or a correction report no larger than 8 MiB.');
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : file.name.toLowerCase().endsWith('.json') ? 'json' : null;
      if (!format) throw Error('Choose a .csv or .json file.');
      const parsed = parseFile(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()), format);
      if (c.signal.aborted) return;
      parsed.rows = parsed.rows.map(decodeCorrection);
      const mapping = defaultColumns(parsed.columns), incoming = projectRows(parsed.rows, mapping);
      if (new Set(incoming.map(r => r.rowId)).size !== incoming.length) throw Error('Repeated row_id values. Give each source row its own stable row_id before uploading.');
      const next = sources.length ? mergeCorrections(sources, incoming) : incoming;
      const id = batchId || crypto.randomUUID();
      setUpload(parsed); setColumns(mapping); setSources(next); setBatchId(id); setExceptionsOnly(false); setFilter('all');
      await validate(next, id, rows, c.signal, values, new Set(incoming.map(r => r.rowId)));
    } catch (e) { if (!c.signal.aborted) { setFileError((e as Error).message); failure(e, c.signal); } }
    finally { if (!c.signal.aborted) setBusy(false); }
  }
  async function remap(mapping: ColumnMap, valueMapping = values) {
    if (!upload) return;
    const c = begin(); setFileError('');
    try {
      const incoming = projectRows(upload.rows, mapping);
      // Changing the row identity is only allowed before any rows are saved.
      const next = rows.some(r => r.operation) || sources.length !== incoming.length
        ? mergeCorrections(sources, incoming) : incoming;
      setSources(next); await validate(next, batchId, rows, c.signal, valueMapping, new Set(incoming.map(r => r.rowId)));
    } catch (e) { failure(e, c.signal); }
    finally { if (!c.signal.aborted) setBusy(false); }
  }
  async function refresh(id = batchId, reopen = false) {
    const c = begin(); setMessage('Refreshing job…');
    try {
      let old = rows, input = sources;
      if (reopen || rows.some(r => r.operation)) {
        const saved = await readJob(id, c.signal), publications = await publicationRows(id, c.signal, saved.operations);
        if (c.signal.aborted) return;
        old = (reopen ? saved.operations.filter(o => o.patch).map(o => ({ input: o.patch!, preview: o.preview ?? undefined, operation: o })) : rows).map(row => {
          const operation = saved.operations.find(o => o.row_id === row.input.rowId);
          return operation ? { ...row, operation, publication: publications.find(p => p.importId === operation.id), failure: undefined } : row;
        });
        if (reopen) {
          input = old.map(r => ({ rowId: r.input.rowId, line: r.input.line, cells: r.input.cells }));
          setSources(input); setBatchId(id); setUpload(null); setFilename(''); setFileError(''); setFilter('all'); setExceptionsOnly(false);
        }
      }
      await validate(input, id, old, c.signal);
      if (reopen && !c.signal.aborted) setSelected(new Set(old.filter(selectable).map(r => r.input.rowId)));
      if (!c.signal.aborted) setJobs(await listJobs(c.signal));
    } catch (e) { failure(e, c.signal); }
    finally { if (!c.signal.aborted) setBusy(false); }
  }
  async function act(action: 'draft' | 'publish') {
    const targets = chosen.filter(r => action === 'publish' || r.operation?.status !== 'imported' || r.correction);
    const confirm = positionsChecked, c = begin();
    setCompletedAction(action); setExceptionsOnly(false); setMessage(`Processing ${targets.length} selected rows…`);
    const outcomes = new Map(rows.map(r => [r.input.rowId, r]));
    try {
      for (let i = 0; i < targets.length; i++) {
        const result = await actOnRow(targets[i]!, batchId, action, confirm, c.signal, ids.current, row => {
          if (!c.signal.aborted) outcomes.set(row.input.rowId, row);
        });
        if (c.signal.aborted) return;
        outcomes.set(result.input.rowId, result);
        if ((i + 1) % 10 === 0 || i + 1 === targets.length) {
          setRows([...outcomes.values()]);
          setMessage(`Processed ${i + 1} of ${targets.length} selected rows`);
        }
      }
      // Recover lost responses and the authoritative completed outcomes once per job.
      const saved = await readJob(batchId, c.signal), publications = await publicationRows(batchId, c.signal, saved.operations);
      if (c.signal.aborted) return;
      const recovered = [...outcomes.values()].map(row => {
        const operation = saved.operations.find(o => o.row_id === row.input.rowId), publication = publications.find(p => p.importId === operation?.id);
        const correctionSaved = operation?.status === 'imported' && operation.patch && sameCells(operation.patch.cells, row.input.cells);
        const succeeded = (!row.correction || correctionSaved) && (action === 'draft' ? operation?.status === 'imported' : publication?.publication?.status === 'published');
        return { ...row, operation: operation ?? row.operation, publication: publication ?? row.publication,
          correction: correctionSaved ? false : row.correction, failure: succeeded ? undefined : row.failure };
      });
      setRows(recovered); setSelected(new Set());
      setJobs(await listJobs(c.signal)); setMessage('');
    } catch (e) { failure(e, c.signal); }
    finally { if (!c.signal.aborted) { setBusy(false); setFilter('all'); setExceptionsOnly(true); } }
  }
  function reset() {
    controller.current?.abort(); setBusy(false); setBatchId(''); setSources([]); setRows([]); setUpload(null); setColumns({}); setSelected(new Set());
    setFilename(''); setFileError(''); setMessage(''); setPublishDecision(false); setPositionsChecked(false); setExceptionsOnly(false); ids.current.clear();
  }
  return <div className={styles.main}>
    <Link href="/admin/shops">← Shop administration</Link>
    <header><p className={styles.eyebrow}>CATALOGUE ADMINISTRATION</p><h1>Bulk shop importer</h1><p>Upload, fix exceptions, and save or publish your selected shops.</p></header>
    <p role="status" aria-live="polite">{message}</p>
    {!options && !denied && <p>Reload the page if catalogue choices do not load.</p>}
    {options && !denied && <>
      <section aria-label="Import files">
        <div className={styles.actions}>
          <button disabled={busy} onClick={() => download(`${VERSION}.csv`, '\uFEFF' + [FIELDS, FIELDS.map(k => k === 'row_id' ? 'shop-001' : '')].map(r => r.map(safeCsvCell).join(',')).join('\r\n'))}>Download CSV template v1</button>
          <button disabled={busy} onClick={() => download(`${VERSION}.json`, JSON.stringify({ version: VERSION, rows: [Object.fromEntries(FIELDS.map(k => [k, k === 'row_id' ? 'shop-001' : '']))] }, null, 2), 'application/json')}>Download JSON template v1</button>
          <label>Reopen job<select value="" disabled={busy} onChange={e => { if (e.target.value) void refresh(e.target.value, true); }}><option value="">Choose a saved job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.createdAt.slice(0, 16).replace('T', ' ')} · {j.rows} rows · {j.id.slice(0, 8)}</option>)}</select></label>
          <button disabled={busy} onClick={reset}>Start a new job</button>
        </div>
        <UploadField label="CSV or JSON file" accept=".csv,.json" filename={filename} disabled={busy} error={fileError} status={filename && !fileError ? busy ? 'Checking file…' : 'File loaded' : ''}
          help={rows.length ? 'Re-upload corrections with the same row_id. Other rows stay in this job.' : 'UTF-8 CSV or JSON · up to 500 rows and 2 MiB. Valid rows are selected automatically.'}
          onSelect={file => { void loadFile(file); }} onClear={() => { controller.current?.abort(); setBusy(false); setFilename(''); setFileError(''); setUpload(null); }} />
        {upload && Object.entries(columns).some(([k, v]) => !v && !['correction_format', 'errors', 'how_to_fix'].includes(k)) && <p role="alert">Columns not imported: {Object.entries(columns).filter(([k, v]) => !v && !['correction_format', 'errors', 'how_to_fix'].includes(k)).map(([k]) => k).join(', ')}. Open Column and value mapping to match these fields.</p>}
        <details><summary>Field instructions</summary><p>Blank cells preserve existing values. Use an exact shop_id to update an existing shop. To clear a value, name it in clear_fields, separated by |. Supplied brands and specialties are added; shop_type sets the primary type. Names never authorize overwrites.</p><p>Supply latitude and longitude together as decimal numbers. Saving retains the coordinates; publication requires a deliberate position confirmation. Country, locality, shop type, brands and specialties must match existing catalogue choices.</p><p>Supply local_name with local_name_language, for example ja-JP. Opening hours, media, sources and experiences are not supported by this template. Keep the correction CSV as UTF-8 to preserve non-English characters.</p><p>Reviewed operations and outcomes can be reopened for 30 days. Unsubmitted rows stay in this page; keep your source file to restore them after a reload. Corrections to saved rows create a fresh reviewed update to the same shop; completed operations are never replayed.</p></details>
        {!!sources.length && <details onToggle={e => setMappingOpen(e.currentTarget.open)}><summary>Column and value mapping · {groups.filter(g => !g.resolved).length} unresolved values</summary>
          {mappingOpen && <>{upload && <><p>Unrecognized columns are ignored until mapped. Check the sample before applying changes.</p><div className={styles.grid}>{upload.columns.filter(c => !['correction_format', 'errors', 'how_to_fix'].includes(c)).map((column, index) => <label key={column}>{column}<select aria-label={`Map ${column}`} disabled={busy} value={columns[column] ?? ''} onChange={e => { const next = { ...columns, [column]: e.target.value }; setColumns(next); setSelected(new Set()); setRows(r => r.filter(x => x.operation?.status === 'imported')); }}><option value="">Ignore this column</option>{FIELDS.map(f => <option key={f} value={f}>{f}</option>)}</select><small>Example: {upload.rows.find(r => r.cells[column])?.cells[column]?.slice(0, 70) || '(blank)'} · column {index + 1}</small></label>)}</div><button disabled={busy} onClick={() => void remap(columns)}>Apply column mapping</button></>}
          <div className={styles.grid}>{groups.map(g => { const choices = vocabularyOptions(g.kind, options, g.country); return <SearchSelect key={g.key} label={`${g.kind}: ${g.raw} (${g.count} rows)`} path={g.key} value={g.resolved ?? ''} valueLabel={choices.find(c => c.id === g.resolved)?.label ?? ''} search={q => choices.filter(c => `${c.label} ${c.id}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60)} onChange={id => {
            const next = { ...values, [g.key]: id ?? '' }; setValues(next); const c = begin();
            void validate(sources, batchId, rows, c.signal, next).catch(e => failure(e, c.signal)).finally(() => { if (!c.signal.aborted) setBusy(false); });
          }} listLabel={`Existing ${g.kind} choices`} placeholder="Find an existing choice" clearLabel="Leave unresolved" disabled={busy} error={g.resolved ? undefined : 'Choose an existing value, or correct the source. Missing vocabulary is never created automatically.'} />; })}</div></>}
        </details>}
      </section>
      {!!sources.length && <section aria-label="Import job" className={styles.job}>
        <div className={styles.jobHeading}><h2>Import job</h2><strong>{rows.filter(r => completedAction === 'publish' ? published(r) : r.operation?.status === 'imported' && !r.correction).length} {completedAction === 'publish' ? 'published' : 'imported'} · {rows.filter(r => !done(r)).length} remaining</strong></div>
        <div className={styles.actions}>
          <button className={styles.primary} disabled={busy || !chosen.some(r => r.operation?.status !== 'imported' || r.correction)} onClick={() => void act('draft')}>Save selected as drafts</button>
          <button disabled={busy || !chosen.length} onClick={() => { setPositionsChecked(false); setPublishDecision(true); }}>Publish selected</button>
          <span>{chosen.length} selected</span>
          <button disabled={busy || !rows.some(r => problems(r).length)} onClick={() => download(`${VERSION}-corrections.csv`, correctionCsv(rows))}>Download correction CSV</button>
          <button disabled={busy} onClick={() => void refresh()}>Refresh job</button>
        </div>
        {publishDecision && <div className={styles.confirmation} role="region" aria-label="Confirm publication">
          <h3>Publish {chosen.length} selected shops?</h3><p>Selected data will be saved and published after validation. Check the selected rows and their changes below. Each shop succeeds or fails independently.</p>
          <label><input type="checkbox" checked={positionsChecked} onChange={e => setPositionsChecked(e.target.checked)} />I have checked the selected addresses and coordinates and confirm these positions.</label>
          <p>Existing confirmed positions remain valid. Without this check, unconfirmed positions stay as drafts with a clear error.</p>
          <div className={styles.actions}><button onClick={() => void act('publish')}>Confirm and publish selected</button><button onClick={() => setPublishDecision(false)}>Cancel</button></div>
        </div>}
        <div className={styles.toolbar}>
          <div role="group" aria-label="Filter import rows" className={styles.filters}>{filters.map(([key, label]) => <button key={key} aria-pressed={filter === key && !exceptionsOnly} disabled={busy} onClick={() => { setFilter(key); setExceptionsOnly(false); }}>{label} ({rows.filter(r => matches(r, key)).length})</button>)}</div>
          <label>Find row or shop<input value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        {exceptionsOnly && <p>Showing remaining rows and failures. <button onClick={() => { setExceptionsOnly(false); setFilter('all'); }}>Show all rows</button></p>}
        <div className={styles.actions}><button disabled={busy} onClick={() => { setSelected(new Set(rows.filter(selectable).map(r => r.input.rowId))); setPublishDecision(false); }}>Select all ready</button><button disabled={busy} onClick={() => { setSelected(new Set()); setPublishDecision(false); }}>Clear selection</button><span>{visible.length} matching rows</span></div>
        <div className={styles.tableScroll} role="region" aria-label="Import rows" tabIndex={0}><table className={styles.table}>
          <caption className={styles.caption}>All job rows · selection applies across filters</caption>
          <thead><tr><th scope="col">Select</th><th scope="col">Row ID</th><th scope="col">Shop</th><th scope="col">Status</th><th scope="col">Country / locality</th><th scope="col">Address</th><th scope="col">Latitude</th><th scope="col">Longitude</th><th scope="col">Problems / changes</th></tr></thead>
          <tbody>{visible.map(row => { const input = row.input, issues = problems(row), coordinates = row.correction ? undefined : row.publication?.coordinates; return <tr key={input.rowId} data-status={status(row)}>
            <td><input type="checkbox" aria-label={`Select ${input.rowId}`} disabled={busy || !selectable(row)} checked={selected.has(input.rowId) && selectable(row)} onChange={e => { setSelected(s => { const next = new Set(s); if (e.target.checked) next.add(input.rowId); else next.delete(input.rowId); return next; }); setPublishDecision(false); }} /></td>
            <th scope="row">{input.rowId}<small>Source row {input.line}</small></th>
            <td><strong>{row.publication?.name || row.preview?.name || input.cells.name || '(name missing)'}</strong>{row.operation?.status === 'imported' && <Link href={`/admin/shops/${row.operation.target_id}`}>Open saved shop</Link>}</td>
            <td><span className={styles.badge}>{status(row)}</span></td>
            <td>{input.cells.country || '—'}<small>{options.localities?.find(l => l.id === input.cells.locality)?.label || input.cells.locality || '—'}</small></td>
            <td>{coordinates?.address ?? input.cells.address_line_1 ?? '—'}</td><td>{coordinates?.latitude ?? input.cells.latitude ?? '—'}</td><td>{coordinates?.longitude ?? input.cells.longitude ?? '—'}</td>
            <td>{issues.length > 0 && <><ul>{issues.map((issue, n) => <li key={n}>{issue}</li>)}</ul><p>{guidance(row)}</p></>}
              {!!row.preview?.publicationErrors.length && !row.operation && <small>Before publication: {row.preview.publicationErrors.join(' ')}</small>}
              <details onToggle={e => { const open = e.currentTarget.open; setExpanded(s => { const next = new Set(s); if (open) next.add(input.rowId); else next.delete(input.rowId); return next; }); }}><summary>{row.publication?.record && !row.correction ? 'Inspect current saved fields' : 'Inspect fields and changes'}</summary>
                {expanded.has(input.rowId) && (row.publication?.record && !row.correction ? <><p>Current saved revision · {row.publication.revision}</p><dl>{Object.entries(row.publication.record.document).map(([group, value]) => <div key={group}><dt>{group}</dt><dd><pre>{JSON.stringify(value, null, 2)}</pre></dd></div>)}</dl></> : <><dl>{Object.entries(input.cells).filter(([, value]) => value).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value}</dd></div>)}</dl>{row.preview?.changes.map(change => <div key={change.field} className={styles.change}><strong>{change.field}{change.clear ? ' · EXPLICIT CLEAR' : ''}</strong><p>{JSON.stringify(change.before)} → {JSON.stringify(change.after)}</p></div>)}</>)}
              </details>
            </td>
          </tr>; })}</tbody>
        </table></div>
        {!visible.length && <p>No matching rows.</p>}
      </section>}
    </>}
  </div>;
}
