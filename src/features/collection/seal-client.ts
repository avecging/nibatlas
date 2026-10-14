import {sealRow,object,uuid,type SealRow} from '@/src/domain/geographic-seals';
export async function fetchSeals(signal:AbortSignal,owner:string,ack:readonly string[]=[]):Promise<SealRow[]> {
 const rows=new Map<string,SealRow>();let after:string|null=null;
 do {
  const response=await fetch('/api/v1/seals',{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({after,ack:after?[]:ack})});
  if(!response.ok) throw Error('Seals unavailable');
  const page=object(await response.json());if(page.ownerId!==owner || !Array.isArray(page.rows) || page.rows.length>50) throw Error('Invalid seal owner or page');
  for(const value of page.rows){const row=sealRow(value);if(after && row.id<=after) throw Error('Invalid page'); rows.set(row.id,row);}
  const next=page.nextCursor==null?null:uuid(page.nextCursor);
  if(next && (page.rows.length!==50 || (after && next<=after) || next!==sealRow(page.rows.at(-1)).id)) throw Error('Invalid cursor');
  after=next;
 } while(after);
 return [...rows.values()];
}
