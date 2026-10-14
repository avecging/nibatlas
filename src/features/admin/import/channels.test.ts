import { expect, it } from 'vitest';
import { prepareRow } from './prepare';
import { FIELDS, MAX_COLUMNS, VERSION } from './contract';
import { parseFile, defaultColumns } from './parse';
import { mapRows, projectRows } from './mapping';
import { document, type ShopRecord } from '../shop-contract';
import { PLATFORMS } from '@/src/domain/shop-channels';
const id='a1000000-0000-4000-8000-000000000001';
const doc=()=>document({shop:{name:'Synthetic',slug:'synthetic',source_quality:'demo',operational_status:'unknown',position_precision:'street'},sources:[],aliases:[],links:[],types:[],brands:[],specialties:[],services:[],experiences:[]});
function prepare(cells:Record<string,string>,record:ShopRecord|null=null){return prepareRow({rowId:'one',line:2,cells,issues:[],fileDuplicates:[]},{rowId:'one',record,candidates:[],truncated:false,conflict:false},{},id);}
it('CSV and JSON accept all platform columns within existing limits',()=>{
  expect(FIELDS.length).toBeLessThanOrEqual(MAX_COLUMNS);
  for (const format of ['csv','json'] as const) {
    const columns=['name',...PLATFORMS], values=['Synthetic',...PLATFORMS.map(p=>p==='xiaohongshu'?'https://xhslink.com/a/token':p==='whatsapp'?'+6581234567':'shopname')];
    const file=parseFile(format==='csv'?columns.join(',')+'\n'+values.join(','):JSON.stringify({version:VERSION,rows:[Object.fromEntries(columns.map((c,i)=>[c,values[i]]))]}),format);
    const rows=mapRows(projectRows(file.rows,defaultColumns(file.columns)),{},{});
    const prepared=prepare(rows[0]!.cells);
    expect(prepared.preview.issues).toEqual([]);
    expect(prepared.document?.links).toHaveLength(13);
    expect(prepare(rows[0]!.cells).document).toEqual(prepared.document);
  }
});
it('keeps omitted/blank links byte-for-byte, edits one channel in place and clears explicitly',()=>{
  const d=doc();d.links=[{id,link_type:'instagram',url:'https://instagram.com/old',label:'Legacy label',is_official:true,sort_order:7},{id:'a1000000-0000-4000-8000-000000000002',link_type:'contact',url:'https://example.test/help',label:'Legacy contact',is_official:false,sort_order:8}];
  const record:ShopRecord={id,revision:'a'.repeat(32),publicationStatus:'published',hasChanges:false,publicationErrors:[],document:d};
  expect(prepare({instagram:' '},record).document?.links).toEqual(d.links);
  const updated=prepare({instagram:'@newname',wechat:'my-id'},record);
  expect(updated.preview.action).toBe('update_private_draft');
  expect(updated.document?.links[0]).toMatchObject({...d.links[0],url:'https://www.instagram.com/newname'});
  expect(updated.document?.links[1]).toEqual(d.links[1]);
  expect(updated.preview.changes.map(c=>c.field)).toEqual(['instagram','wechat']);
  expect(prepare({clear_fields:'instagram'},record).document?.links).toEqual([d.links[1]]);
  expect(prepare({clear_fields:'instagram',instagram:'@newname'},record).preview.action).toBe('blocked');
});
it('validates the complete merged document without losing contact values',()=>{
  const p=prepare({name:'Synthetic',wechat:'shop-id',line:'personal-id'});
  expect(p.preview.issues).toEqual([]);
  const record:ShopRecord={id,revision:'a'.repeat(32),publicationStatus:'draft',hasChanges:true,publicationErrors:[],document:p.document!};
  expect(prepare({name:'Changed'},record).document?.links).toEqual(record.document.links);
  expect(prepare({wechat:'javascript:bad'},record).preview.issues).toEqual(expect.arrayContaining([expect.objectContaining({path:'wechat'})]));
});
