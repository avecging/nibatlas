import type { Document, Options, ShopRecord } from '../shop-contract';

export type PublicationOperation = {
  id: string; status: 'reviewed' | 'published' | 'conflicted' | 'failed';
  review_key: string; expected_revision: string; position_confirmed: boolean;
  reason: string | null; created_at: string; published_at: string | null;
};
export type PublicationRow = {
  importId: string; rowId: string; targetId: string; name: string; slug: string;
  kind: 'new_draft' | 'private_update' | 'already_published' | 'not_imported';
  importStatus: string; reviewKey: string | null; revision: string | null;
  positionConfirmed: boolean; coordinates: { latitude: number | null; longitude: number | null; address: string | null };
  blockers: string[]; conflict: boolean; reviewed: boolean; canReview: boolean; canConfirm: boolean; canPublish: boolean;
  publication: PublicationOperation | null;
  options?: Options; record?: ShopRecord; publicDocument?: Document | null;
};
export type PublicationPage = { rows: PublicationRow[]; nextOffset: number | null };
