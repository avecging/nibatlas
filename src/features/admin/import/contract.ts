import { SHOP_FIELDS, type Document, type Options, type ShopRecord, type Value } from '../shop-contract';
import type { FieldIssue } from '../shop-normalization';

export const VERSION = 'nibatlas-shops-v1';
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 500;
export const BATCH_SIZE = 25;
export const MAX_COLUMNS = 64;
// Historical classifications/dates and all attestations are deliberately not import inputs.
export const SCALARS = SHOP_FIELDS.filter(f => !['source_quality', 'last_verified_at', 'locality_id', 'country_code'].includes(f.key));
export const VOCABULARIES = ['country', 'locality', 'shop_type', 'brands', 'specialties'] as const;
export type Vocabulary = typeof VOCABULARIES[number];
export const FIELDS = ['row_id', 'shop_id', ...SCALARS.map(f => f.key), ...VOCABULARIES, 'clear_fields'];
export type Cells = Record<string, string>;
export interface InputRow { rowId: string; line: number; cells: Cells }
export interface Upload { version: typeof VERSION; columns: string[]; rows: InputRow[] }
export type ColumnMap = Record<string, string>;
export type ValueMap = Record<string, string>;
export interface MappedRow { rowId: string; line: number; cells: Cells; issues: FieldIssue[]; fileDuplicates: string[] }
export interface Candidate { id: string; name: string; slug: string; reason: string }
export interface Context { rowId: string; record: ShopRecord | null; candidates: Candidate[]; truncated: boolean; conflict: boolean }
export interface Change { field: string; before: Value; after: Value; clear: boolean }
export interface PreviewRow {
  rowId: string; line: number; name: string; targetId: string | null; revision: string | null;
  action: 'new_private_draft' | 'update_private_draft' | 'no_change' | 'review_duplicates' | 'blocked';
  issues: FieldIssue[]; candidates: Candidate[]; fileDuplicates: string[]; changes: Change[];
  publicationErrors: string[]; hasPrivateChanges: boolean; reviewKey?: string;
}
export interface Prepared { preview: PreviewRow; document: Document | null; proposedId: string }
export interface Bootstrap { options: Options }

export interface ImportOperation {
  id: string; row_id: string; operation_revision: number; target_id: string;
  review_key: string; patch: MappedRow | null; preview: PreviewRow | null;
  status: 'ready' | 'imported' | 'skipped' | 'conflicted' | 'failed'; reason: string | null;
}
export interface ImportBatch { id: string; operations: ImportOperation[] }
export interface BatchSummary { id: string; createdAt: string; expiresAt: string; rows: number }
export const eligible = (row: PreviewRow) => !!row.reviewKey && ['new_private_draft', 'update_private_draft'].includes(row.action);
