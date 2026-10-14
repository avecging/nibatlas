// @vitest-environment node
import { expect,it,vi } from 'vitest';
import { privateR2Store } from './r2';
it('isolates environments and never grants public reads or overwrites',async()=>{
  const bucket={put:vi.fn(async()=>null),get:vi.fn(async()=>null)};
  const store=privateR2Store(bucket,'staging');
  const suffix=`media/70000000-0000-4000-8000-000000000001/v1/${'a'.repeat(64)}.png`;
  await expect(store.get('production/'+suffix)).rejects.toThrow();
  await expect(store.get('staging/../'+suffix)).rejects.toThrow();
  expect(bucket.get).not.toHaveBeenCalled();
  await store.putOnce('staging/'+suffix,new Uint8Array([1]));
  const options=bucket.put.mock.calls[0] as unknown as [string,Uint8Array,{onlyIf:Headers;httpMetadata:{cacheControl:string}}];
  expect(options[2].onlyIf.get('If-None-Match')).toBe('*');
  expect(options[2].httpMetadata.cacheControl).toBe('private, no-store');
  expect(()=>privateR2Store(bucket,'preview')).toThrow();
});
