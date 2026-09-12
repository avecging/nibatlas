import { describe, it, expect, vi } from 'vitest';
import { listCollections } from './collections';
import { ISSUED_STAMP, STAMP_OWNER } from '@/src/test/stamp';

describe('private collection read contract', () => {
  const request = (query='') => new Request(`https://nibatlas.test/api/v1/collections${query}`);
  it('projects history, current navigation, owner and no-store headers',async () => {
    const response=await listCollections(request(),{getIdentity:async()=>STAMP_OWNER,
      list:async()=>[{...ISSUED_STAMP,anomaly_flags:['private'],user_id:STAMP_OWNER}]});
    expect(await response.json()).toEqual({ownerId:STAMP_OWNER,collections:[ISSUED_STAMP],nextCursor:null});
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
  });
  it('denies anonymous reads before accessing history',async()=>{
    const list=vi.fn(); const response=await listCollections(request(),{getIdentity:async()=>null,list});
    expect(response.status).toBe(401); expect(list).not.toHaveBeenCalled();
  });
  it.each(['?userId='+STAMP_OWNER,'?after=no','?after='+STAMP_OWNER+'&after='+STAMP_OWNER])('rejects invalid/owner-supplied query %s',async(query)=>{
    expect((await listCollections(request(query),{getIdentity:async()=>STAMP_OWNER,list:async()=>[]})).status).toBe(400);
  });
  it('uses a bounded keyset page and returns an exclusive next cursor',async()=>{
    const rows=Array.from({length:101},(_,i)=>({...ISSUED_STAMP,id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));
    const list=vi.fn(async()=>rows);
    const response=await listCollections(request('?after='+STAMP_OWNER),{getIdentity:async()=>STAMP_OWNER,list});
    const body=await response.json(); expect(body.collections).toHaveLength(100);
    expect(body.nextCursor).toBe(rows[99]?.id); expect(list).toHaveBeenCalledWith(STAMP_OWNER);
  });
  it('contains provider failures without logging them',async()=>{
    const error=vi.spyOn(console,'error').mockImplementation(()=>{});
    const response=await listCollections(request(),{getIdentity:async()=>STAMP_OWNER,list:async()=>{throw new Error('private payload');}});
    expect(await response.json()).toEqual({ok:false,error:{code:'service_unavailable'}});
    expect(error).not.toHaveBeenCalled(); error.mockRestore();
  });
});
