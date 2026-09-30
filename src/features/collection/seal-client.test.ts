import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchSeals} from './seal-client';
const owner='10000000-0000-4000-8000-000000000001';
afterEach(()=>vi.unstubAllGlobals());
describe('seal owner isolation',()=>{
 it('rejects a response refreshed into another account',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ownerId:'other',rows:[],nextCursor:null})));await expect(fetchSeals(new AbortController().signal,owner)).rejects.toThrow('Invalid seal owner');});
 it('sends receipts only with the cookie owner request',async()=>{const fetch=vi.fn<(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>>(async()=>Response.json({ownerId:owner,rows:[],nextCursor:null}));vi.stubGlobal('fetch',fetch);await expect(fetchSeals(new AbortController().signal,owner,[owner])).resolves.toEqual([]);expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({after:null,ack:[owner]});});
 it('rejects a cursor without a complete page',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ownerId:owner,rows:[],nextCursor:owner})));await expect(fetchSeals(new AbortController().signal,owner)).rejects.toThrow('Invalid cursor');});
});
