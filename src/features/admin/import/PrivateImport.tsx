'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { readAdminResponse } from '../read-response';
import { VERSION, eligible, type BatchSummary, type ImportBatch, type MappedRow, type PreviewRow } from './contract';
import styles from './ImportAdmin.module.css';
async function request(signal: AbortSignal, batchId?: string, payload?: unknown) {
  const response = await fetch(`/api/v1/admin/import/batches${!payload && batchId ? `?batch=${batchId}` : ''}`, {
    method: payload ? 'POST' : 'GET', signal, cache: 'no-store', credentials: 'same-origin',
    ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
  });
  // Batch lists are arrays; wrap them for the shared safe object reader.
  if (response.ok && !payload && !batchId) {
    const batches = await response.json();
    if (!Array.isArray(batches)) throw Error('Saved batches unavailable. Retry loading them.');
    return { batches };
  }
  const data = await readAdminResponse(response, !!payload);
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Batch access unavailable. Sign in with the admin who created it.' :
    response.status === 409 ? 'This row changed. Reopen the batch, preview and review again.' : 'Request interrupted. Reopen this batch to recover the saved outcomes before continuing.');
  return data;
}
export function PrivateImport({ batchId, rows, previews, onResume, onBusyChange, blocked }: {
  batchId: string; rows: MappedRow[]; previews: PreviewRow[]; onResume: (batch: ImportBatch) => void; onBusyChange: (busy: boolean) => void; blocked: boolean;
}) {
  const [batches, setBatches] = useState<BatchSummary[]>([]), [saved, setSaved] = useState<ImportBatch | null>(null);
  const [selected, setSelected] = useState<string[]>([]), [message, setMessage] = useState(''), [working, setBusy] = useState(false);
  const busy = working || blocked;
  const [confirmationIds, setConfirmationIds] = useState<string[]>([]);
  const [page, setPage] = useState(0), [confirmation, setConfirmation] = useState(false);
  const controller = useRef<AbortController | null>(null), operationIds = useRef(new Map<string, string>());
  const current = useRef(true);
  useEffect(() => { current.current = true; const c = new AbortController(); controller.current = c;
    void request(c.signal).then(d => { if (!c.signal.aborted) setBatches(d.batches); }).catch(() => {});
    return () => { current.current = false; controller.current?.abort(); };
  }, []);
  const [inputs, setInputs] = useState({ previews, batchId });
  if (inputs.previews !== previews || inputs.batchId !== batchId) {
    setInputs({ previews, batchId }); setSelected([]); setConfirmation(false); setPage(0);
    if (inputs.batchId !== batchId) setSaved(previous => previous?.id === batchId ? previous : null);
  }
  useEffect(() => { operationIds.current.clear(); }, [previews, batchId]);
  const choices = previews.filter(eligible).filter(p => !saved?.operations.some(o => saved.id === batchId && o.row_id === p.rowId && o.status === 'imported'));
  const chosen = choices.filter(p => selected.includes(p.rowId));
  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    const c = new AbortController(); controller.current?.abort(); controller.current = c; setBusy(true); onBusyChange(true); setMessage('');
    try { await work(c.signal); } catch (e) { if (!c.signal.aborted) { setConfirmation(false); setMessage((e as Error).message); } }
    finally { if (current.current && !c.signal.aborted) { setBusy(false); onBusyChange(false); } }
  };
  const open = async (id: string, signal: AbortSignal) => {
    const data = await request(signal, id) as ImportBatch;
    if (signal.aborted) return data;
    setSaved(data); setConfirmation(false); onResume(data); return data;
  };
  const review = () => run(async signal => {
    for (let i = 0; i < chosen.length; i++) {
      const preview = chosen[i]!, row = rows.find(r => r.rowId === preview.rowId)!;
      const key = `${batchId}:${preview.rowId}:${preview.reviewKey}`;
      if (!operationIds.current.has(key)) operationIds.current.set(key, crypto.randomUUID());
      const previous = saved?.id === batchId ? saved.operations.find(o => o.row_id === row.rowId) : undefined;
      await request(signal, undefined, { version: VERSION, action: 'review', batchId, operationId: operationIds.current.get(key), previousOperation: previous?.id ?? null, row, reviewKey: preview.reviewKey });
      if (signal.aborted) return;
      setMessage(`Prepared ${i + 1} of ${chosen.length} selected rows. Shops have not changed.`);
    }
    const data = await request(signal, batchId) as ImportBatch;
    if (signal.aborted) return;
    setSaved(data); setConfirmationIds(data.operations.filter(o => selected.includes(o.row_id)).map(o => o.id)); setConfirmation(true);
    const list = await request(signal); if (!signal.aborted) setBatches(list.batches);
  });
  const execute = () => run(async signal => {
    if (!saved) return;
    const operations = saved.operations.filter(o => confirmationIds.includes(o.id) && (o.status === 'ready' || o.status === 'failed'));
    setConfirmation(false);
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]!;
      const result = await request(signal, undefined, { version: VERSION, action: 'execute', batchId: saved.id, operationId: op.id });
      if (signal.aborted) return;
      setSaved(prev => prev ? { ...prev, operations: prev.operations.map(o => o.id === op.id ? { ...o, status: result.status, reason: result.reason } : o) } : prev);
      setMessage(`Processed ${i + 1} of ${operations.length} pending rows. Results below include conflicts and failures.`);
    }
    const data = await request(signal, saved.id) as ImportBatch;
    if (!signal.aborted) { setSaved(data); setMessage('Import finished. Review each result below. Nothing was published.'); }
  });
  const pending = saved?.operations.filter(o => o.status === 'ready' || o.status === 'failed') ?? [];
  const confirmed = pending.filter(o => confirmationIds.includes(o.id));
  return <section aria-labelledby="private-import-heading">
    <h2 id="private-import-heading">5. Save selected private drafts</h2>
    <p>Only valid new shops and explicit updates can be selected. Publication warnings do not block saving. Batches belong to your admin account and can be reopened for 30 days.</p>
    <p role="status">{message}</p>
    <div className={styles.actions}><button disabled={busy} onClick={() => void run(async signal => { const data = await request(signal); if (!signal.aborted) setBatches(data.batches); })}>Refresh saved batches</button>
      <label>Reopen batch<select aria-label="Reopen batch" value="" disabled={busy} onChange={e => { if (e.target.value) void run(signal => open(e.target.value, signal).then(() => {})); }}><option value="">Choose a saved batch</option>{batches.map(b => <option key={b.id} value={b.id}>{b.createdAt.slice(0, 16).replace('T', ' ')} · {b.rows} rows · {b.id.slice(0, 8)}</option>)}</select></label>
    </div>
    {!!choices.length && <>
      <div className={styles.actions}><button disabled={busy} onClick={() => { setSelected(choices.map(p => p.rowId)); setConfirmation(false); }}>Select all eligible rows ({choices.length})</button><button disabled={busy} onClick={() => { setSelected([]); setConfirmation(false); }}>Clear selection</button></div>
      <p>{chosen.length} selected · {chosen.filter(p => p.action === 'new_private_draft').length} new · {chosen.filter(p => p.action === 'update_private_draft').length} updates</p>
      {choices.slice(page * 25, (page + 1) * 25).map(p => <label className={styles.field} key={p.rowId}><span><input type="checkbox" disabled={busy} checked={selected.includes(p.rowId)} onChange={e => { setSelected(s => e.target.checked ? [...s, p.rowId] : s.filter(id => id !== p.rowId)); setConfirmation(false); }} /> {p.name} · {p.rowId} · {p.action === 'new_private_draft' ? 'New draft' : 'Explicit update'}</span>{p.changes.some(c => c.clear) && <strong>Explicit clears: {p.changes.filter(c => c.clear).map(c => c.field).join(', ')} — inspect before/after in the preview above.</strong>}</label>)}
      <div className={styles.actions}><button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous eligible rows</button><button disabled={busy || (page + 1) * 25 >= choices.length} onClick={() => setPage(page + 1)}>Next eligible rows</button><button disabled={busy || !chosen.length} onClick={() => void review()}>Review selected rows</button></div>
    </>}
    {saved && <>
      <h3>Saved batch · {saved.id.slice(0, 8)}</h3>
      <p>{saved.operations.filter(o => o.status === 'imported').length} imported · {saved.operations.filter(o => o.status === 'conflicted').length} conflicted · {saved.operations.filter(o => o.status === 'failed').length} failed · {saved.operations.filter(o => o.status === 'skipped').length} skipped · {saved.operations.filter(o => o.status === 'ready').length} pending</p>
      {saved.operations.map(o => <details key={o.id} className={styles.row}><summary>{o.preview?.name || o.row_id} · {o.status} · revision {o.operation_revision}</summary>
        {o.reason && <p>{o.reason}</p>}{o.status === 'imported' && <Link href={`/admin/shops/${o.target_id}`}>Open successful draft</Link>}
        {o.preview?.changes.map(c => <p key={c.field}>{c.field}{c.clear ? ' · EXPLICIT CLEAR' : ''}: <code>{JSON.stringify(c.before)}</code> → <code>{JSON.stringify(c.after)}</code></p>)}
      </details>)}
      {!!pending.length && !confirmation && <button disabled={busy} onClick={() => { setConfirmationIds(pending.map(o => o.id)); setConfirmation(true); }}>Review remaining import</button>}
      {confirmation && <div role="region" aria-label="Confirm private import" className={styles.row}>
        <h3>Import selected as drafts?</h3><p>{confirmed.filter(o => !o.preview?.targetId).length} new shops and {confirmed.filter(o => o.preview?.targetId).length} private updates. Nothing becomes public. Existing published pages stay unchanged.</p>
        <ul>{confirmed.filter(o => o.preview?.changes.some(c => c.clear)).map(o => <li key={o.id}>{o.preview?.name}: explicitly clear {o.preview?.changes.filter(c => c.clear).map(c => c.field).join(', ')}. Before/after is retained in the saved row above.</li>)}</ul>
        <div className={styles.actions}><button disabled={busy || !confirmed.length} onClick={() => void execute()}>Import selected as drafts</button><button disabled={busy} onClick={() => setConfirmation(false)}>Cancel</button></div>
      </div>}
      <p>For corrections, reopen this batch, load a corrected file with the same row_id values, then preview and review again. Completed rows are never repeated. Reload or refresh saved batches after an interrupted request.</p>
    </>}
  </section>;
}
