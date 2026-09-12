import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeCollection, fetchCollections, stampRequest } from './collection-client';
import { ISSUED_STAMP, STAMP_OWNER } from '@/src/test/stamp';

afterEach(()=>vi.unstubAllGlobals());
describe('historical collection adapter',()=>{
  it('uses snapshot artwork, place, name and shop-local date',()=>{
    const collection=decodeCollection(ISSUED_STAMP);
    expect(collection).toMatchObject({shopNameSnapshot:'Historical Demo Shop',collectedOn:'2026-09-12',
      countryCode:'JP',localitySlug:'tokyo',simulated:false,stamp:{motif:'counter',ink:'teal'}});
    expect(decodeCollection({...ISSUED_STAMP,shopSlug:null}).shopSlug).toBe('');
  });
  it.each([
    {...ISSUED_STAMP,shopTimezone:'invalid'},
    {...ISSUED_STAMP,stamp:{...ISSUED_STAMP.stamp,id:'different'}},
    {...ISSUED_STAMP,stamp:{...ISSUED_STAMP.stamp,templateData:{tier:'shop',motif:'unknown'}}},
    {...ISSUED_STAMP,shopSlug:'../../admin'},
  ])('rejects malformed snapshots instead of inventing artwork',value=>expect(()=>decodeCollection(value)).toThrow());
  it('retains commissioned credit/exports without generating substitute artwork',()=>{
    const c=decodeCollection({...ISSUED_STAMP,stamp:{...ISSUED_STAMP.stamp,artworkKind:'commissioned',illustratorCredit:'Fixture Artist',
      cleanSvgKey:'approved/clean.svg',cleanSvgSha256:'a'.repeat(64),outlinedSvgKey:'approved/outlined.svg',outlinedSvgSha256:'b'.repeat(64),
      transparentPngKey:'approved/art.png',transparentPngSha256:'c'.repeat(64)}});
    expect(c.stamp.commissioned?.illustratorCredit).toBe('Fixture Artist');
  });
  it('rejects a read from a different verified account',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ownerId:'other',collections:[ISSUED_STAMP],nextCursor:null})));
    await expect(fetchCollections(new AbortController().signal,STAMP_OWNER)).rejects.toThrow('Session changed');
  });
  it('fetches all pages without persisting history',async()=>{
    const page=Array.from({length:100},(_,i)=>({...ISSUED_STAMP,id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));
    const fetch=vi.fn().mockResolvedValueOnce(Response.json({ownerId:STAMP_OWNER,collections:page,nextCursor:page[99]?.id}))
      .mockResolvedValueOnce(Response.json({ownerId:STAMP_OWNER,collections:[],nextCursor:null}));
    vi.stubGlobal('fetch',fetch);
    expect(await fetchCollections(new AbortController().signal,STAMP_OWNER)).toHaveLength(100);
    expect(fetch.mock.calls[1]?.[0]).toBe(`/api/v1/collections?after=${page[99]?.id}`);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({cache:'no-store',credentials:'same-origin'});
  });
  it('contains network errors and malformed success responses',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:true,status:'success',collection:{}})));
    expect(await stampRequest('collect',{},new AbortController().signal)).toEqual({ok:false,error:{code:'service_unavailable'}});
  });
});
