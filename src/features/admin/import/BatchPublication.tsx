'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { readAdminResponse } from '../read-response';
import { GROUPS, HOURS_FIELDS, SHOP_FIELDS, type Document, type Field, type Options, type Value } from '../shop-contract';
import { VERSION } from './contract';
import type { PublicationPage, PublicationRow } from './publication-contract';
import styles from './ImportAdmin.module.css';

async function request(signal: AbortSignal, query: string, payload?: unknown) {
  const response = await fetch(`/api/v1/admin/import/publication${query}`, {
    method: payload ? 'POST' : 'GET', signal, credentials: 'same-origin', cache: 'no-store',
    ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
  });
  const data = await readAdminResponse(response, !!payload);
  if (!response.ok) throw Error(response.status === 401 || response.status === 403
    ? 'Batch access unavailable. Sign in with the admin who created it.'
    : response.status === 409 ? 'A reviewed row changed. Reload the review and review affected rows again.'
    : 'Request interrupted. Reload publication review to recover saved outcomes before continuing.');
  return data;
}
const stateLabel = (r: PublicationRow) => r.publication?.status === 'published' ? 'Published from this batch'
  : r.conflict ? 'Changed — review again' : r.kind === 'not_imported' ? 'Private import unresolved'
  : r.kind === 'already_published' ? 'Already published' : r.canPublish ? 'Ready to publish'
  : r.blockers.length ? 'Needs attention' : 'Awaiting review';

export function BatchPublication({ batchId, blocked, onBusyChange }: {
  batchId: string; blocked: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [rows, setRows] = useState<PublicationRow[] | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [page, setPage] = useState(0);
  const [details, setDetails] = useState<Record<string, PublicationRow>>({});
  const [message, setMessage] = useState(''), [working, setWorking] = useState(false), [recover, setRecover] = useState(false);
  const [decision, setDecision] = useState<'publish' | 'confirm_position' | null>(null);
  const controller = useRef<AbortController | null>(null), current = useRef(true);
  const operationIds = useRef(new Map<string, string>());
  useEffect(() => { current.current = true; return () => { current.current = false; controller.current?.abort(); }; }, []);
  const busy = working || blocked;
  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    const c = new AbortController(); controller.current?.abort(); controller.current = c;
    setWorking(true); onBusyChange(true); setMessage(''); setDecision(null);
    try { await work(c.signal); } catch (e) {
      if (!c.signal.aborted) { setRecover(true); setSelected([]); setMessage(`${(e as Error).message} Reload publication review before continuing.`); }
    } finally { if (current.current && !c.signal.aborted) { setWorking(false); onBusyChange(false); } }
  };
  const load = () => run(async signal => {
    const result: PublicationRow[] = []; let offset: number | null = 0;
    // At most 500 rows, in 25-row responses. No full documents in this list.
    for (let i = 0; i < 20 && offset !== null; i++) {
      const data = await request(signal, `?batch=${batchId}&offset=${offset}`) as PublicationPage;
      if (signal.aborted) return;
      if (!Array.isArray(data.rows) || data.rows.length > 25 || data.nextOffset !== null && data.nextOffset !== offset + 25) throw Error('Review unavailable. Reload it before continuing.');
      result.push(...data.rows); offset = data.nextOffset;
    }
    setRows(result); setSelected([]); setDetails({}); setPage(0); setRecover(false);
    setMessage(`Loaded ${result.length} saved rows. Select only the rows you intend to review or publish.`);
  });
  const chosen = (rows ?? []).filter(r => selected.includes(r.importId));
  const confirmable = chosen.filter(r => r.canConfirm);
  const publishable = chosen.filter(r => r.canPublish);
  const replace = (row: PublicationRow) => {
    setRows(previous => previous?.map(r => r.importId === row.importId ? row : r) ?? null);
    setDetails(previous => { const next = { ...previous }; delete next[row.importId]; return next; });
  };
  const act = (action: 'review' | 'confirm_position' | 'publish') => run(async signal => {
    const targets = action === 'confirm_position' ? confirmable : chosen;
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const row = targets[i]!;
      const key = `${row.importId}:${row.reviewKey}:${row.publication?.id ?? ''}`;
      if (action === 'review' && !operationIds.current.has(key)) operationIds.current.set(key, crypto.randomUUID());
      const result = await request(signal, '', { version: VERSION, action, batchId, importId: row.importId,
        operationId: action === 'review' ? operationIds.current.get(key) : row.publication!.id,
        ...(action === 'review' ? { reviewKey: row.reviewKey, previousOperation: row.publication?.id ?? null } : {}),
      }) as PublicationRow;
      if (signal.aborted) return;
      replace(result);
      const succeeded = action === 'publish' ? result.publication?.status === 'published'
        : action === 'confirm_position' ? result.reviewed && result.positionConfirmed : result.reviewed;
      if (!succeeded) failed++;
      if (action === 'publish' && succeeded) setSelected(previous => previous.filter(id => id !== row.importId));
      setMessage(`Processed ${i + 1} of ${targets.length} selected rows; ${failed} need attention.`);
    }
    setMessage(`${action === 'publish' ? 'Publication' : action === 'review' ? 'Review' : 'Position confirmation'} finished: ${targets.length - failed} successful, ${failed} need attention. Saved outcomes remain available after reload.`);
  });
  const visible = (rows ?? []).filter(r => `${r.name} ${r.rowId} ${r.coordinates.address ?? ''}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === 'all' || filter === 'ready' && r.canPublish || filter === 'attention' && (r.blockers.length > 0 || r.conflict || r.publication?.status === 'failed') || filter === 'published' && (r.publication?.status === 'published' || r.kind === 'already_published') || filter === r.kind));
  return <section aria-labelledby="publication-heading">
    <h2 id="publication-heading">6. Review and publish saved rows</h2>
    <p>Review the saved content, confirm positions deliberately, then publish selected shops. Photos and stamp designs keep their separate publication and activation controls.</p>
    <button disabled={busy} onClick={() => void load()}>{rows ? 'Reload publication review' : 'Load publication review'}</button>
    <p role="status">{message}</p>
    {rows && <>
      <div className={styles.grid}>
        <label>Search saved review rows<input value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
        <label>Filter saved review rows<select value={filter} disabled={busy} onChange={e => { setFilter(e.target.value); setPage(0); }}>
          <option value="all">All saved rows</option><option value="new_draft">New private drafts</option><option value="private_update">Private updates</option>
          <option value="ready">Ready to publish</option><option value="attention">Needs attention</option><option value="published">Published</option>
        </select></label>
      </div>
      <p><strong>{chosen.length} selected</strong> across all pages and filters · {publishable.length} publishable · {chosen.length - publishable.length} not yet publishable.</p>
      <div className={styles.actions}>
        <button disabled={busy || recover || !visible.some(r => r.canReview)} onClick={() => { setSelected(s => [...new Set([...s, ...visible.slice(page * 25, (page + 1) * 25).filter(r => r.canReview).map(r => r.importId)])]); setDecision(null); }}>Select reviewable rows on this page</button>
        <button disabled={busy} onClick={() => { setSelected([]); setDecision(null); }}>Clear publication selection</button>
        <button disabled={busy || recover || !chosen.length || chosen.some(r => !r.canReview)} onClick={() => void act('review')}>Mark selected reviewed ({chosen.length})</button>
        <button disabled={busy || recover || !confirmable.length} onClick={() => setDecision('confirm_position')}>Confirm selected positions ({confirmable.length})</button>
        <button disabled={busy || recover || !chosen.length || publishable.length !== chosen.length} onClick={() => setDecision('publish')}>Publish selected rows ({publishable.length})</button>
      </div>
      {decision && <div role="region" aria-label={decision === 'publish' ? 'Confirm selected publication' : 'Confirm saved positions'} className={styles.row}>
        <h3>{decision === 'publish' ? `Publish exactly ${chosen.length} selected shops?` : `Confirm exactly ${confirmable.length} saved positions?`}</h3>
        <p>{decision === 'publish' ? 'These reviewed saved revisions will become public. Successful rows will not be repeated. Failed or changed rows stay here for correction.' : 'Confirm only after checking these saved addresses and coordinates against your information. Import success and decimal precision do not establish the location.'}</p>
        <ul>{(decision === 'publish' ? chosen : confirmable).map(r => <li key={r.importId}>{r.name} · {r.rowId}{decision === 'confirm_position' && <> · {r.coordinates.address || 'Address unknown'} · {r.coordinates.latitude}, {r.coordinates.longitude}</>}</li>)}</ul>
        <div className={styles.actions}><button disabled={busy} onClick={() => void act(decision)}>{decision === 'publish' ? 'Confirm publication of selected rows' : 'I have checked these saved positions'}</button><button disabled={busy} onClick={() => setDecision(null)}>Cancel publication action</button></div>
      </div>}
      {visible.slice(page * 25, (page + 1) * 25).map(row => <article key={row.importId} className={styles.row}>
        <label className={styles.field}><input type="checkbox" disabled={busy || recover || !row.canReview} checked={selected.includes(row.importId)} onChange={e => { setSelected(s => e.target.checked ? [...s, row.importId] : s.filter(id => id !== row.importId)); setDecision(null); }} />{row.name} · {row.rowId}</label>
        <p>{stateLabel(row)} · {row.kind === 'private_update' ? 'Private update to existing shop' : row.kind === 'new_draft' ? 'New private draft' : row.kind.replaceAll('_', ' ')}</p>
        <p>{row.coordinates.address || 'Address unknown'} · Coordinates: {row.coordinates.latitude ?? 'unknown'}, {row.coordinates.longitude ?? 'unknown'} · Position {row.positionConfirmed ? 'confirmed' : 'not confirmed'} · {row.publication?.status === 'published' ? 'Batch publication complete' : row.kind === 'already_published' ? 'No pending private changes' : row.reviewed ? 'Saved revision reviewed' : 'Review required'}</p>
        {!!row.blockers.length && <ul aria-label={`Blockers for ${row.rowId}`}>{row.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        {row.publication && <p>Last attempt: {row.publication.status} · {row.publication.published_at ?? row.publication.created_at}{row.publication.reason && ` · ${row.publication.reason}`}</p>}
        <div className={styles.actions}>
          {row.importStatus === 'imported' && <><Link href={`/admin/shops/${row.targetId}`}>Correct {row.name}</Link><button disabled={busy} onClick={() => void run(async signal => {
            const detail = await request(signal, `?batch=${batchId}&import=${row.importId}`) as PublicationRow;
            if (!signal.aborted) {
              replace(detail); setDetails(previous => ({ ...previous, [row.importId]: detail }));
              setSelected(previous => previous.filter(id => id !== row.importId));
              setMessage('Loaded current saved and public content. Inspect it, then select the row again.');
            }
          })}>Inspect saved / public content for {row.rowId}</button></>}
          {(row.publication?.status === 'published' || row.kind === 'already_published' || row.kind === 'private_update') && row.slug && <Link href={`/shops/${encodeURIComponent(row.slug)}`}>Public page for {row.name}</Link>}
        </div>
        {details[row.importId]?.record && <details open><summary>Saved and public content · {row.rowId}</summary>
          <p>Compare the saved revision with the published revision below. Fields labelled private stay private.</p>
          <DocumentComparison saved={details[row.importId]!.record!.document} published={details[row.importId]!.publicDocument ?? null} options={details[row.importId]!.options ?? {}} />
        </details>}
      </article>)}
      <p>{visible.length ? `Review rows ${page * 25 + 1}–${Math.min((page + 1) * 25, visible.length)} of ${visible.length}` : 'No matching rows.'}</p>
      <div className={styles.actions}><button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous review rows</button><button disabled={busy || (page + 1) * 25 >= visible.length} onClick={() => setPage(page + 1)}>Next review rows</button></div>
    </>}
  </section>;
}

function display(value: Value | undefined, field: Field, options: Options): string {
  if (value === null || value === undefined || value === '') return 'Unknown / not supplied';
  if (field.vocabulary) return options[field.vocabulary]?.find(o => o.id === value)?.label ?? String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
function DocumentComparison({ saved, published, options }: { saved: Document; published: Document | null; options: Options }) {
  const compare = (label: string, before: string, after: string) => <div className={styles.change} key={label}>
    <dt>{label}{published && before !== after ? ' · Changed' : ''}</dt>
    <dd><div><strong>Saved</strong><p>{after}</p></div><div><strong>Published</strong><p>{published ? before : 'Not published'}</p></div></dd>
  </div>;
  const hours = (d: Document | null) => {
    const h = d?.shop.opening_hours;
    if (!h || typeof h !== 'object' || Array.isArray(h)) return 'Unknown / not supplied';
    const entries = Array.isArray(h.entries) ? h.entries : [];
    return [h.note ? `Note: ${String(h.note)}` : '', ...entries.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return '';
      return HOURS_FIELDS.filter(f => entry[f.key] !== null && entry[f.key] !== undefined).map(f => `${f.label}: ${display(entry[f.key], f, options)}`).join(' · ');
    })].filter(Boolean).join('\n') || 'No hours recorded';
  };
  return <dl>{compare('Opening hours', hours(published), hours(saved))}{SHOP_FIELDS.map(f => compare(f.label, display(published?.shop[f.key], f, options), display(saved.shop[f.key], f, options)))}
    {GROUPS.map(g => {
      const format = (d: Document | null) => d?.[g.key].map(row => g.fields.filter(f => row[f.key] !== null && row[f.key] !== undefined).map(f => `${f.label}: ${display(row[f.key], f, options)}`).join(' · ')).join('\n\n') || 'None recorded';
      return compare(g.label, format(published), format(saved));
    })}</dl>;
}
