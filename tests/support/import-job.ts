import { randomUUID } from 'node:crypto';
import type { ShopAdminGateway } from '../../src/server/admin/shop-http';
import type { Document, ShopRecord } from '../../src/features/admin/shop-contract';
import type { ImportOperation, MappedRow, PreviewRow } from '../../src/features/admin/import/contract';
import type { PublicationRow } from '../../src/features/admin/import/publication-contract';
export const fixtureId = '77000000-0000-4000-8000-000000000001';
export const fixtureOptions = { localities: [{ id: fixtureId, label: 'Synthetic City', countryCode: 'SG' }], types: [{ id: fixtureId, label: 'Stationery', code: 'stationery' }], brands: [], specialties: [], services: [] };
/** Isolated transport fixture; SQL tests cover the actual transaction/permission boundaries. */
export function importJobGateway() {
  const ledger = new Map<string, ImportOperation>(), documents = new Map<string, Document>(), records = new Map<string, ShopRecord>();
  const publications = new Map<string, PublicationRow>(), writes = new Map<string, number>(), publishWrites = new Map<string, number>();
  const calls: { name: string; args: Record<string, unknown> | undefined }[] = [];
  let batchId = '';
  const key = 'a'.repeat(64);
  const latest = () => [...new Map([...ledger.values()].map(o => [o.row_id, o])).values()];
  function pub(op: ImportOperation): PublicationRow {
    if (publications.has(op.id)) return publications.get(op.id)!;
    const record = records.get(op.target_id), shop = record?.document.shop;
    const row: PublicationRow = { importId: op.id, rowId: op.row_id, targetId: op.target_id, name: String(shop?.name ?? op.row_id), slug: String(shop?.slug ?? ''),
      kind: op.status === 'imported' ? 'new_draft' : 'not_imported', importStatus: op.status, reviewKey: key, revision: record?.revision ?? null,
      positionConfirmed: false, coordinates: { latitude: shop?.latitude as number ?? null, longitude: shop?.longitude as number ?? null, address: shop?.address_line_1 as string ?? null },
      blockers: ['Check and confirm the saved shop position.', ...(!shop?.address_line_1 ? ['Add the street address.'] : [])], conflict: false, reviewed: false,
      canReview: op.status === 'imported', canConfirm: false, canPublish: false, publication: null };
    publications.set(op.id, row); return row;
  }
  const gateway: ShopAdminGateway = { getIdentity: async () => fixtureId, getAccess: async () => ({ role: 'admin' }), listAudit: async () => [], call: async (name, args) => {
    calls.push({ name, args });
    if (name === 'admin_shop_options') return fixtureOptions;
    if (name === 'admin_import_preview') {
      const rows = args!.p_rows as { rowId: string; id: string | null; name: string }[];
      return args?.p_mode === 'context' ? rows.map(r => ({ rowId: r.rowId, record: r.id ? records.get(r.id) ?? null : null,
        candidates: r.name?.startsWith('Duplicate') ? [{ id: fixtureId, name: 'Existing shop', slug: 'existing', reason: 'similar name' }] : [], truncated: false, conflict: false }))
        : rows.map(r => ({ rowId: r.rowId, issues: [], publicationErrors: ['Check and confirm the saved shop position.'], reviewKey: key }));
    }
    if (name === 'admin_import_batches') return args?.p_batch ? { id: batchId, operations: structuredClone(latest()) } : batchId ? [{ id: batchId, createdAt: '2026-10-02T00:00:00Z', expiresAt: '2026-11-01T00:00:00Z', rows: latest().length }] : [];
    if (name === 'admin_import_operation_read') return structuredClone(ledger.get(String(args?.p_operation)));
    if (name === 'admin_import_operation') {
      const id = String(args?.p_operation), payload = args?.p_payload as Record<string, unknown>;
      if (args?.p_action === 'review') {
        batchId = String(args.p_batch);
        if (!ledger.has(id)) {
          const previous = ledger.get(String(payload.previousOperation));
          ledger.set(id, { id, row_id: (payload.row as MappedRow).rowId, operation_revision: (previous?.operation_revision ?? 0) + 1, target_id: String(payload.targetId), review_key: key,
            patch: structuredClone(payload.row) as MappedRow, preview: payload.preview as PreviewRow, status: 'ready', reason: null });
          documents.set(id, structuredClone(payload.document) as Document);
        }
      } else {
        const op = ledger.get(id)!;
        if (op.status !== 'imported') {
          op.status = op.patch?.cells.name === 'Fail this row' ? 'failed' : 'imported';
          op.reason = op.status === 'failed' ? 'Draft validation failed. Correct name and retry.' : null;
          if (op.status === 'imported') {
            writes.set(op.row_id, (writes.get(op.row_id) ?? 0) + 1); op.result_revision = randomUUID();
            records.set(op.target_id, { id: op.target_id, revision: op.result_revision, publicationStatus: 'draft', hasChanges: true, document: documents.get(id)!, publicationErrors: [], positionConfirmed: false });
          }
        }
      }
      const op = ledger.get(id)!; return { id, rowId: op.row_id, status: op.status, reason: op.reason, targetId: op.target_id };
    }
    if (name === 'admin_import_publication_read') {
      if (args?.p_import) { const row = pub(ledger.get(String(args.p_import))!); return structuredClone({ ...row, record: records.get(row.targetId), options: fixtureOptions }); }
      const offset = Number(args?.p_offset ?? 0), rows = latest().map(pub);
      return { rows: structuredClone(rows.slice(offset, offset + 25)), nextOffset: offset + 25 < rows.length ? offset + 25 : null };
    }
    if (name === 'admin_import_publication') {
      const row = pub(ledger.get(String(args?.p_import))!);
      if (args?.p_action === 'review') {
        row.reviewed = true; row.canConfirm = !row.positionConfirmed && row.coordinates.latitude !== null && row.coordinates.longitude !== null;
        row.publication = { id: String(args.p_operation), status: 'reviewed', review_key: key, expected_revision: row.revision!, position_confirmed: row.positionConfirmed, reason: null, created_at: '2026-10-02T00:00:00Z', published_at: null };
      } else if (args?.p_action === 'confirm_position') {
        row.positionConfirmed = true; row.canConfirm = false; row.blockers = row.blockers.filter(b => b !== 'Check and confirm the saved shop position.');
      } else if (args?.p_action === 'publish' && row.publication?.status !== 'published') {
        row.publication!.status = 'published'; row.kind = 'already_published'; row.canReview = false;
        publishWrites.set(row.rowId, (publishWrites.get(row.rowId) ?? 0) + 1);
      }
      row.canPublish = row.reviewed && !row.blockers.length && row.kind !== 'already_published';
      return structuredClone(row);
    }
    throw Error(`Unexpected RPC ${name}`);
  } };
  return { gateway, ledger, records, publications, calls, writes, publishWrites };
}
export const syntheticCsv = (count: number) => 'row_id,name,country,locality,shop_type,address_line_1,latitude,longitude,timezone\n' +
  Array.from({ length: count }, (_, i) => `row-${i},Synthetic ${i},SG,Synthetic City,stationery,Synthetic address,1.3,103.8,Asia/Singapore`).join('\n');
