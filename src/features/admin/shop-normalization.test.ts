import { describe, expect, it } from 'vitest';
import { normalizeShopCreate, normalizeShopDocument, ShopValidationError } from './shop-normalization';
const id='60000000-0000-4000-8000-000000000001';
const base=()=>({shop:{name:'Synthetic 文具店',slug:'synthetic-shop',source_quality:'community_unverified',operational_status:'unknown',position_precision:'locality'},sources:[],aliases:[],links:[],types:[],services:[],specialties:[],brands:[]});
function errors(value:unknown) {
  try { normalizeShopDocument(value); throw Error('Expected invalid document'); }
  catch(e) { if(!(e instanceof ShopValidationError)) throw e; return e.issues; }
}
describe('shared full-document normalization',()=>{
  it('normalizes mapped text cells and manual values identically without inventing facts',()=>{
    const value=base();
    const shop={...value.shop,name:'  Synthetic 文具店  ',country_code:' sg ',latitude:'0',longitude:'-0.5',appointment_required:'false',postal_code:'00123',phone:'+65 00123',short_description:'First paragraph.\n\n第二段。'};
    const result=normalizeShopDocument({...value,shop});
    expect(result).toEqual(normalizeShopDocument({...value,shop:{...shop,latitude:0,longitude:-0.5,appointment_required:false}}));
    expect(result.shop).toMatchObject({name:'Synthetic 文具店',country_code:'SG',latitude:0,longitude:-0.5,appointment_required:false,postal_code:'00123',phone:'+65 00123',short_description:'First paragraph.\n\n第二段。',last_verified_at:null});
    expect(value.shop.name).toBe('Synthetic 文具店');
    expect(normalizeShopDocument(result)).toEqual(result);
  });
  it('keeps incomplete name-only documents and optional blanks as unknown',()=>{
    const d=normalizeShopDocument({...base(),shop:{...base().shop,website_url:'  ',appointment_required:''}});
    expect(d.shop).toMatchObject({latitude:null,longitude:null,timezone:null,website_url:null,appointment_required:null});
    expect(d.sources).toEqual([]);
  });
  it.each([['latitude',91],['longitude',-181],['latitude','1oops'],['latitude','0x10'],['latitude',Infinity],['timezone','Not/AZone'],['website_url','https://u:p@example.test'],['last_verified_at','2099-01-01'],['website_url','https://'],['website_url','javascript:alert(1)'],['last_verified_at','2026-02-30'],['last_verified_at','2026-09-20junk']])('identifies bad %s without echoing its value',(key,value)=>{
    const result=errors({...base(),shop:{...base().shop,[key]:value}});
    expect(result.some(e=>e.path===`shop.${key}`)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('alert(1)');
  });
  it('reports both malformed coordinates and preserves zero',()=>{
    expect(errors({...base(),shop:{...base().shop,latitude:0}})).toContainEqual({path:'shop.longitude',message:'Supply both latitude and longitude, or leave both unknown.'});
    expect(normalizeShopDocument({...base(),shop:{...base().shop,latitude:0,longitude:0}}).shop.latitude).toBe(0);
  });
  it('preserves split and overnight spans, but identifies unpaired or closed times',()=>{
    const hours={entries:[{day:'monday',opens:'22:00',closes:'02:00'},{day:'monday',opens:'09:00',closes:'12:00'}]};
    expect((normalizeShopDocument({...base(),shop:{...base().shop,opening_hours:hours}}).shop.opening_hours as {entries:unknown[]}).entries).toHaveLength(2);
    const result=errors({...base(),shop:{...base().shop,opening_hours:{entries:[{day:'tuesday',opens:'25:00',closed:true}]}}});
    expect(result.map(e=>e.path)).toEqual(expect.arrayContaining(['shop.opening_hours.entries.0.opens','shop.opening_hours.entries.0.closes','shop.opening_hours.entries.0.closed']));
  });
  it('preserves dated split and overnight exceptions without changing weekly hours',()=>{
    const opening_hours={entries:[{day:'monday',opens:'10:00',closes:'18:00'}],exceptions:[
      {date:'2026-12-25',closed:true,note:'Holiday'},
      {date:'2026-12-31',opens:'10:00',closes:'12:00',closed:false},
      {date:'2026-12-31',opens:'22:00',closes:'02:00',closed:false,note:'Next day'},
    ]};
    const result=normalizeShopDocument({...base(),shop:{...base().shop,opening_hours}});
    expect(result.shop.opening_hours).toMatchObject(opening_hours);
    expect(normalizeShopDocument(result)).toEqual(result);
  });
  it('rejects impossible dates, missing times, closed conflicts and excessive exceptions',()=>{
    const check=(exceptions:unknown[])=>errors({...base(),shop:{...base().shop,opening_hours:{entries:[],exceptions}}}).map(e=>e.path);
    expect(check([{date:'2026-02-30'}])).toContain('shop.opening_hours.exceptions.0.date');
    expect(check([{date:'2026-12-25',opens:'25:00'}])).toEqual(expect.arrayContaining(['shop.opening_hours.exceptions.0.opens','shop.opening_hours.exceptions.0.closes']));
    expect(check([{date:'2026-12-25',closed:true},{date:'2026-12-25',opens:'09:00',closes:'12:00'}])).toContain('shop.opening_hours.exceptions.1.date');
    expect(check(Array.from({length:101},()=>({date:'2026-12-25'})))).toContain('shop.opening_hours.exceptions');
  });
  it('preserves source identities and historical timestamps while cleaning claim line breaks',()=>{
    const d=normalizeShopDocument({...base(),sources:[{id,label:'Legacy',source_type:'official',source_url:'https://example.test',checked_at:'2026-09-01T12:34:56.123456+08:00',reliability:'primary',status:'active',claims:['Name','  ',' Name '],evidence_note:'Private\n\nnotes'}]});
    expect(d.sources[0]).toMatchObject({id,checked_at:'2026-09-01T12:34:56.123456+08:00',claims:['Name'],evidence_note:'Private\n\nnotes'});
  });
  it('rejects a partial import row instead of replacing omitted relationships',()=>{
    expect(errors({shop:base().shop}).map(e=>e.path)).toEqual(expect.arrayContaining(['sources','types','brands']));
  });
  it('bounds malformed input errors and rejects private/publication injection',()=>{
    const d={...base(),shop:{...base().shop,publication_status:'published'},brands:Array.from({length:100},()=>({brand_id:'invalid',source_id:'invalid'}))};
    const result=errors(d);expect(result.length).toBeLessThanOrEqual(100);expect(result[0]?.path).toBe('shop');
  });
  it('normalizes IDs before checking duplicate relationships and source ownership',()=>{
    const upper='AAAAAAAA-0000-4000-8000-000000000001';
    const result=errors({...base(),brands:[{brand_id:upper},{brand_id:upper.toLowerCase(),source_id:id}]});
    expect(result.map(e=>e.path)).toEqual(expect.arrayContaining(['brands.1.brand_id','brands.1.source_id']));
  });
});
describe('creation-only URL assistance',()=>{
  it('supports non-Latin names and stable retry identity without touching saved slugs',()=>{
    expect(normalizeShopCreate({name:' 文具店 '},id)).toEqual({name:'文具店',slug:`shop-${id}`});
    expect(normalizeShopCreate({name:'A shop'},id).slug).toBe(`a-shop-${id}`);
    expect(normalizeShopDocument({...base(),shop:{...base().shop,name:'New name'}}).shop.slug).toBe('synthetic-shop');
  });
  it('preserves a supplied slug and rejects malformed values',()=>{
    expect(normalizeShopCreate({name:'A',slug:'existing-url'},id).slug).toBe('existing-url');
    expect(()=>normalizeShopCreate({name:'A',slug:123},id)).toThrow(ShopValidationError);
    expect(()=>normalizeShopCreate({name:' ',slug:'a'},id)).toThrow(ShopValidationError);
  });
});

describe('B2 editorial input', () => {
  it('keeps private references separate, paragraphs intact, and stable experience identities', () => {
    const result = normalizeShopDocument({ ...base(), shop: { ...base().shop, field_note_body: 'First\n\n第二段', reference_links: 'https://example.test/one\nhttps://example.test/two', internal_notes: 'Private\n\nmaintenance' },
      experiences: [{ id, category: 'nib_testing', title: 'Try nibs', description: 'One\n\nTwo' }] });
    expect(result.shop.field_note_body).toBe('First\n\n第二段');
    expect(result.shop.internal_notes).toBe('Private\n\nmaintenance');
    expect(result.experiences[0]).toMatchObject({ id, title: 'Try nibs', description: 'One\n\nTwo' });
  });
  it('identifies an invalid private reference and invalid repeatable field', () => {
    expect(errors({ ...base(), shop: { ...base().shop, reference_links: 'https://example.test\njavascript:alert(1)' },
      experiences: [{ id, category: 'unsupported', title: '' }] }).map(e => e.path))
      .toEqual(expect.arrayContaining(['shop.reference_links', 'experiences.0.category', 'experiences.0.title']));
  });
  it('preserves curated icons and rejects arbitrary icon payloads at the exact field', () => {
    const experience = { id, category: 'nib_testing', title: 'Try nibs', icon: 'nib' };
    expect(normalizeShopDocument({...base(), experiences:[experience]}).experiences[0]?.icon).toBe('nib');
    for (const icon of ['unknown', '<svg/>', 'https://example.test/icon.svg']) {
      expect(errors({...base(), experiences:[{...experience,icon}]}).map(e=>e.path)).toContain('experiences.0.icon');
    }
  });
  it('rejects import/manual attempts to assert review or confirmation in data', () => {
    for (const key of ['reviewed_by','reviewed_at','position_confirmation'])
      expect(errors({ ...base(), shop: { ...base().shop, [key]: 'forged' } })).toContainEqual({ path: 'shop', message: 'Remove unsupported fields.' });
  });
});
