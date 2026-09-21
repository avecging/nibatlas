import { authorizeAdmin, adminFailure, AdminForbiddenError } from './http';
import { ADMIN_HEADERS, type ShopAdminGateway } from './shop-http';
import { decodeOptions, decodeShop, object, UUID } from '@/src/features/admin/shop-contract';
import { BATCH_SIZE, FIELDS, VERSION, type Context, type MappedRow } from '@/src/features/admin/import/contract';
import { prepareRow, proposedIdentity } from '@/src/features/admin/import/prepare';
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: ADMIN_HEADERS });
export async function importBody(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error();
  const reader = request.body?.getReader(); if (!reader) throw Error();
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 262144) { await reader.cancel(); throw Error(); } chunks.push(next.value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}
export function parseRows(raw: unknown): MappedRow[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > BATCH_SIZE) throw Error();
  const ids = new Set<string>();
  return raw.map(value => {
    const r = object(value), cells = object(r.cells);
    if (Object.keys(r).some(k => !['rowId', 'line', 'cells', 'issues', 'fileDuplicates'].includes(k)) ||
      typeof r.rowId !== 'string' || !/^[\p{L}\p{N}_.:-]{1,100}$/u.test(r.rowId) || ids.has(r.rowId) || !Number.isInteger(r.line) || Number(r.line) < 1 || Number(r.line) > 100000 ||
      Object.entries(cells).some(([k, v]) => !FIELDS.includes(k) || typeof v !== 'string' || v.length > 4000) ||
      !Array.isArray(r.issues) || r.issues.length > 100 || r.issues.some(i => !i || typeof i !== 'object' || typeof i.path !== 'string' || i.path.length > 100 || typeof i.message !== 'string' || i.message.length > 300) ||
      !Array.isArray(r.fileDuplicates) || r.fileDuplicates.length > 500 || r.fileDuplicates.some(i => typeof i !== 'string' || i.length > 150)) throw Error();
    ids.add(r.rowId);
    return { rowId: r.rowId, line: Number(r.line), cells: cells as MappedRow['cells'], issues: r.issues, fileDuplicates: r.fileDuplicates };
  });
}
export async function handleImport(request: Request, gateway: ShopAdminGateway) {
  try {
    const access = await authorizeAdmin(gateway, 'admin'); if (access instanceof Response) return access;
    if (new URL(request.url).search) return adminFailure('invalid_request');
    if (request.method === 'GET') return json({ options: decodeOptions(await gateway.call('admin_shop_options')) });
    if (request.method !== 'POST') return adminFailure('invalid_request');
    if (request.headers.get('origin') !== new URL(request.url).origin) return adminFailure('forbidden');
    let rows: MappedRow[], batchId: string;
    try {
      const input = await importBody(request);
      if (input.version !== VERSION || typeof input.batchId !== 'string' || !UUID.test(input.batchId) || Object.keys(input).some(k => !['version', 'batchId', 'rows'].includes(k))) throw Error();
      rows = parseRows(input.rows); batchId = input.batchId;
    } catch { return json({ error: { code: 'invalid_request' }, message: 'Use at most 25 rows and 256 KiB per preview request. Check row IDs and mapped fields.' }, 400); }
    const prepared = await prepareImport(rows, batchId, gateway);
    return json({ version: VERSION, rows: prepared.map(r => r.preview) });
  } catch (e) { return adminFailure(e instanceof AdminForbiddenError ? 'forbidden' : 'service_unavailable'); }
}

export async function prepareImport(rows: MappedRow[], batchId: string, gateway: ShopAdminGateway) {
    const options = decodeOptions(await gateway.call('admin_shop_options'));
    const rawContexts = await gateway.call('admin_import_preview', { p_mode: 'context', p_rows: rows.map(r => ({ rowId: r.rowId, id: UUID.test(r.cells.shop_id?.trim() ?? '') ? r.cells.shop_id!.trim() : null, name: r.cells.name?.trim() || null, slug: r.cells.slug?.trim() || null, country: /^[A-Z]{2}$/.test(r.cells.country ?? '') ? r.cells.country : null })) });
    if (!Array.isArray(rawContexts) || rawContexts.length !== rows.length) throw Error();
    const contexts = rawContexts.map((value, i): Context => {
      const c = object(value);
      if (c.rowId !== rows[i]!.rowId || !Array.isArray(c.candidates) || c.candidates.length > 10 || typeof c.truncated !== 'boolean' || typeof c.conflict !== 'boolean') throw Error();
      return { rowId: String(c.rowId), record: c.record ? decodeShop(c.record) : null, candidates: c.candidates.map(value => { const m = object(value); if (typeof m.id !== 'string' || !UUID.test(m.id) || typeof m.name !== 'string' || typeof m.slug !== 'string' || typeof m.reason !== 'string') throw Error(); return { id: m.id, name: m.name, slug: m.slug, reason: m.reason }; }), truncated: c.truncated, conflict: c.conflict };
    });
    const prepared = await Promise.all(rows.map(async (r, i) => prepareRow(r, contexts[i]!, options, await proposedIdentity(batchId, r.rowId))));
    const ready = prepared.filter(r => r.document);
    // Imported cells can be tiny while existing private documents are large.
    // Bound the merged payload too; leave room for PostgreSQL JSONB whitespace.
    const batches: typeof ready[] = [];
    let pending: typeof ready = [], bytes = 2;
    for (const item of ready) {
      const size = new TextEncoder().encode(JSON.stringify(item.document)).length + 400;
      if (pending.length && bytes + size > 900000) { batches.push(pending); pending = []; bytes = 2; }
      pending.push(item); bytes += size;
    }
    if (pending.length) batches.push(pending);
    for (const ready of batches) {
      const validated = await gateway.call('admin_import_preview', { p_mode: 'validate', p_rows: ready.map(r => ({ rowId: r.preview.rowId, id: r.preview.targetId ?? r.proposedId, revision: r.preview.revision, document: r.document })) });
      if (!Array.isArray(validated) || validated.length !== ready.length) throw Error();
      validated.forEach((v, i) => {
        const r = object(v), p = ready[i]!.preview;
        if (r.rowId !== p.rowId || !Array.isArray(r.issues) || !Array.isArray(r.publicationErrors)) throw Error();
        for (const issue of r.issues) { if (typeof issue?.path !== 'string' || typeof issue?.message !== 'string') throw Error(); p.issues.push({ path: issue.path, message: issue.message }); }
        if (!r.publicationErrors.every(e => typeof e === 'string')) throw Error();
        p.publicationErrors = r.publicationErrors;
        if (typeof r.reviewKey === 'string' && /^[a-f0-9]{64}$/.test(r.reviewKey)) p.reviewKey = r.reviewKey;
        if (p.issues.length) p.action = 'blocked';
      });
    }
    return prepared;
}
