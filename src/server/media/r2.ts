import type { PrivateMediaStore } from './http';

// Narrow structural binding contract keeps provider types out of the domain.
export interface MediaBucket {
  put(key: string, bytes: Uint8Array, options: { onlyIf: Headers; httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
  get(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string }; body: ReadableStream<Uint8Array> } | null>;
}
export function privateR2Store(bucket: MediaBucket, environment: string): PrivateMediaStore {
  if (!['staging','production'].includes(environment)) throw Error('Invalid media environment');
  const keyCheck=(key: string) => {
    if (!new RegExp(`^${environment}/media/[a-f0-9-]{36}/v1/[a-f0-9]{64}\\.png$`).test(key)) throw Error('Invalid media key');
  };
  return {
    async putOnce(key,bytes) {
      keyCheck(key);
      // A retry may find the same immutable key. Finalization always reads it back.
      await bucket.put(key,bytes,{ onlyIf: new Headers({ 'If-None-Match': '*' }), httpMetadata: { contentType: 'image/png', cacheControl: 'private, no-store' } });
    },
    async get(key) {
      keyCheck(key);
      const value=await bucket.get(key);
      return value ? { size:value.size,contentType:value.httpMetadata?.contentType,body:value.body } : null;
    },
  };
}
