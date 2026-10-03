import { readAdminResponse } from '../read-response';
import { BATCH_SIZE, VERSION, type BatchSummary, type ImportBatch, type ImportOperation, type MappedRow, type PreviewRow } from './contract';
import type { PublicationPage, PublicationRow } from './publication-contract';
import { guidance, type JobRow } from './job';

export class ImportAccessError extends Error {}
export async function importRequest<T>(path: string, signal: AbortSignal, payload?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/admin/import${path}`, {
    method: payload ? 'POST' : 'GET', signal, cache: 'no-store', credentials: 'same-origin',
    ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
  });
  if (response.status === 401 || response.status === 403) throw new ImportAccessError('Bulk import requires a signed-in admin account with access to this job.');
  if (path === '/batches' && !payload && response.ok) {
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw Error('Saved jobs unavailable. Refresh and try again.');
    return data as T;
  }
  const data = await readAdminResponse(response, !!payload);
  if (!response.ok) throw Error(data.message || (response.status === 409
    ? 'The saved row or duplicate matches changed. Refresh this job, check the changes, then retry.'
    : 'Request interrupted. Refresh this job to recover saved outcomes, then retry.'));
  return data as T;
}
export const listJobs = (signal: AbortSignal) => importRequest<BatchSummary[]>('/batches', signal);
export const readJob = (id: string, signal: AbortSignal) => importRequest<ImportBatch>(`/batches?batch=${id}`, signal);
export async function publicationRows(id: string, signal: AbortSignal, operations: ImportOperation[]) {
  const rows: PublicationRow[] = []; let offset: number | null = 0;
  for (let i = 0; i < 20 && offset !== null; i++) {
    const data: PublicationPage = await importRequest(`/publication?batch=${id}&offset=${offset}`, signal);
    if (!Array.isArray(data.rows) || data.rows.length > 25 || data.nextOffset !== null && data.nextOffset !== offset + 25) throw Error('Invalid saved job response. Refresh this job.');
    rows.push(...data.rows); offset = data.nextOffset;
  }
  // A fresh publication key must always be accompanied by the content it binds,
  // including when recovery happens automatically at the end of a bulk action.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!, op = operations.find(o => o.id === row.importId);
    if (op?.status === 'imported' && row.canReview && row.revision !== op.result_revision) {
      rows[i] = await importRequest(`/publication?batch=${id}&import=${row.importId}`, signal);
      if (!rows[i]?.record || rows[i]!.record!.revision !== rows[i]!.revision) throw Error('Current saved content could not be loaded. Refresh this job before publishing.');
    }
  }
  return rows;
}
export async function previewRows(rows: MappedRow[], batchId: string, signal: AbortSignal): Promise<JobRow[]> {
  const results = new Map<string, JobRow>();
  const valid = rows.filter(r => !r.issues.length);
  for (const input of rows.filter(r => r.issues.length)) results.set(input.rowId, { input });
  for (let i = 0; i < valid.length;) {
    const chunk: MappedRow[] = [];
    while (i < valid.length && chunk.length < BATCH_SIZE) {
      if (new TextEncoder().encode(JSON.stringify({ version: VERSION, batchId, rows: [...chunk, valid[i]] })).length > 250000) {
        if (!chunk.length) { const input = valid[i++]!; results.set(input.rowId, { input, failure: 'Row is too large. Shorten long cells and re-upload this row.' }); continue; }
        break;
      }
      chunk.push(valid[i++]!);
    }
    if (!chunk.length) continue;
    try {
      const data = await importRequest<{ version: string; rows: PreviewRow[] }>('', signal, { version: VERSION, batchId, rows: chunk });
      if (data.version !== VERSION || !Array.isArray(data.rows) || data.rows.length !== chunk.length || data.rows.some((p, n) => p.rowId !== chunk[n]!.rowId)) throw Error('Invalid preview response. Refresh this job.');
      chunk.forEach((input, n) => results.set(input.rowId, { input, preview: data.rows[n] }));
    } catch (e) {
      if (signal.aborted || e instanceof ImportAccessError) throw e;
      chunk.forEach(input => results.set(input.rowId, { input, failure: (e as Error).message }));
    }
  }
  return rows.map(r => results.get(r.rowId)!);
}

type OperationResult = { id: string; status: ImportOperation['status']; reason: string | null; targetId: string; resultRevision?: string };
/** Each mutation retains its existing server-side validation, binding and transaction. */
export async function actOnRow(row: JobRow, batchId: string, action: 'draft' | 'publish', confirmPosition: boolean,
  signal: AbortSignal, ids: Map<string, string>, onChange: (row: JobRow) => void): Promise<JobRow> {
  let current: JobRow = { ...row, failure: undefined };
  const operationId = (key: string) => { if (!ids.has(key)) ids.set(key, crypto.randomUUID()); return ids.get(key)!; };
  const replace = (update: Partial<JobRow>) => { current = { ...current, ...update }; onChange(current); };
  try {
    let savedRevision: string | undefined;
    if (current.operation?.status !== 'imported' || current.correction) {
      if (!current.preview?.reviewKey) throw Error('Refresh this job to validate this row before saving.');
      const id = operationId(`draft:${batchId}:${row.input.rowId}:${current.preview.reviewKey}:${current.operation?.id ?? ''}`);
      const reviewed = await importRequest<OperationResult>('/batches', signal, { version: VERSION, action: 'review', batchId,
        operationId: id, previousOperation: current.operation?.id ?? null, row: current.input, reviewKey: current.preview.reviewKey });
      replace({ operation: { id: reviewed.id, row_id: row.input.rowId, operation_revision: (current.operation?.operation_revision ?? 0) + 1,
        target_id: reviewed.targetId, review_key: current.preview.reviewKey, patch: current.input, preview: current.preview, status: reviewed.status, reason: reviewed.reason } });
      const result = await importRequest<OperationResult>('/batches', signal, { version: VERSION, action: 'execute', batchId, operationId: id });
      replace({ operation: { ...current.operation!, status: result.status, reason: result.reason, result_revision: result.resultRevision ?? null }, correction: false, publication: undefined });
      if (result.status !== 'imported') throw Error(result.reason || 'Draft could not be saved. Refresh, correct this row, and retry.');
      savedRevision = result.resultRevision;
    }
    if (action === 'draft') return current;
    let publication = current.publication;
    if (!publication) {
      publication = await importRequest<PublicationRow>(`/publication?batch=${batchId}&import=${current.operation!.id}`, signal);
      // Never silently review a concurrent edit which the operator did not see.
      if (!savedRevision || publication.revision !== savedRevision) throw Error('Saved revision changed or could not be verified. Refresh this job and inspect the saved shop before publishing.');
    }
    if (publication.kind === 'already_published' || publication.publication?.status === 'published') { replace({ publication }); return current; }
    if (!publication.canReview || !publication.reviewKey) throw Error(publication.blockers.join(' ') || 'Open the saved shop to resolve the conflict, then refresh this job.');
    const reviewed = await importRequest<PublicationRow>('/publication', signal, { version: VERSION, action: 'review', batchId,
      importId: publication.importId, operationId: operationId(`publish:${publication.importId}:${publication.reviewKey}:${publication.publication?.id ?? ''}`),
      reviewKey: publication.reviewKey, previousOperation: publication.publication?.id ?? null });
    replace({ publication: reviewed });
    if (reviewed.canConfirm && confirmPosition) {
      const shown = row.publication?.coordinates ?? { latitude: Number(row.input.cells.latitude), longitude: Number(row.input.cells.longitude), address: row.input.cells.address_line_1 || null };
      if ((!row.publication && (!row.input.cells.latitude?.trim() || !row.input.cells.longitude?.trim())) ||
        shown.latitude !== reviewed.coordinates.latitude || shown.longitude !== reviewed.coordinates.longitude || shown.address !== reviewed.coordinates.address) {
        throw Error('The saved position differs from the displayed input. Refresh this job, check its saved coordinates and address, then publish.');
      }
      replace({ publication: await importRequest<PublicationRow>('/publication', signal, { version: VERSION, action: 'confirm_position', batchId,
        importId: reviewed.importId, operationId: reviewed.publication!.id }) });
    }
    if (!current.publication?.canPublish) throw Error(current.publication?.blockers.join(' ') || 'Check and confirm the saved position, then retry publication.');
    replace({ publication: await importRequest<PublicationRow>('/publication', signal, { version: VERSION, action: 'publish', batchId,
      importId: current.publication.importId, operationId: current.publication.publication!.id }) });
    if (current.publication?.publication?.status !== 'published') throw Error(current.publication?.blockers.join(' ') || 'Publication failed. Refresh this job and retry.');
  } catch (e) {
    if (signal.aborted || e instanceof ImportAccessError) throw e;
    replace({ failure: (e as Error).message || guidance(current) });
  }
  return current;
}
