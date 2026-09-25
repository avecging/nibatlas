import { describe, expect, it } from 'vitest';
import { document, type Options, type ShopRecord } from './shop-contract';
import { projectSavedShopPreview } from './public-preview';
import { projectShopDetail } from '@/src/features/shops/shop-detail-projection';
import { decodeShopDetailV1 } from '@/src/api/v1/shop-read';
const id='61000000-0000-4000-8000-000000000001', type='61000000-0000-4000-8000-000000000002';
const options:Options={localities:[],types:[{id:type,code:'fountain_pen_specialist',label:'Fountain Pen Specialist'}],services:[],specialties:[],brands:[]};
function fixture():ShopRecord { return {id,revision:'a'.repeat(32),publicationStatus:'draft',publicationErrors:[],hasChanges:true,document:document({sources:[],aliases:[],links:[],services:[],specialties:[],brands:[],shop:{name:'Synthetic shop',slug:'synthetic-shop',country_code:'SG',city_display:'Singapore',timezone:'Asia/Singapore',latitude:0,longitude:0,position_precision:'street',operational_status:'unknown',source_quality:'community_unverified'},types:[{shop_type_id:type,is_primary:true}]})}; }

describe('saved public renderer projection',()=>{
  it('matches the public adapter for a saved document, without asserting a review',()=>{
    const record=fixture();
    record.document.shop.short_description='Synthetic introduction';
    record.document.shop.field_note_body='First paragraph\n\n第二段';
    record.document.shop.appointment_required=false;
    record.document.shop.opening_hours={entries:[{day:'monday',closed:null,opens:'22:00',closes:'02:00'}],exceptions:[{date:'2026-12-25',closed:true}]};
    const preview=projectSavedShopPreview(record,options)!;
    const wire=decodeShopDetailV1({id,slug:'synthetic-shop',name:'Synthetic shop',countryCode:'SG',localityName:'Singapore',position:{latitude:0,longitude:0},positionPrecision:'street',timezone:'Asia/Singapore',primaryType:'fountain_pen_specialist',primaryTypeLabel:'Fountain Pen Specialist',shopTypes:['fountain_pen_specialist'],shopTypeLabels:{fountain_pen_specialist:'Fountain Pen Specialist'},markerState:'unvisited',operationalStatus:'unknown',sourceQuality:'community_unverified',specialtyLine:null,specialties:[],services:[],brands:[],sources:[],links:[],shortDescription:'Synthetic introduction',editorial:{field_note_body:'First paragraph\n\n第二段',appointment_required:false,experiences:[]},openingHours:[{day:'monday',opens:'22:00',closes:'02:00'}],openingHoursExceptions:[{date:'2026-12-25',closed:true}]})!;
    expect(preview).toEqual({...projectShopDetail(wire,{demoRecords:true}),services:[]});
    expect(preview.review).toBeUndefined();
  });
  it('never passes private maintenance fields or unapproved links to the renderer',()=>{
    const record=fixture();
    Object.assign(record.document.shop,{internal_notes:'PRIVATE NOTE',reference_links:'https://secret.test/reference',reviewed_by:'PRIVATE ACTOR'});
    record.document.links=[{id:type,link_type:'other',url:'https://secret.test/link',is_official:false}];
    record.document.sources=[{id:type,label:'Public source',source_type:'official',checked_at:'2026-09-01',claims:['Name'],evidence_note:'PRIVATE EVIDENCE',reliability:'primary'}];
    const result=JSON.stringify(projectSavedShopPreview(record,options));
    expect(result).not.toMatch(/PRIVATE|secret.test|reliability/);
    expect(result).toContain('Public source');
  });
  it('keeps canonical labels, primary type, local name ordering and official links',()=>{
    const record=fixture();
    const second='61000000-0000-4000-8000-000000000003';
    record.document.shop.locality_id=second;
    record.document.shop.website_url='https://example.test/';
    record.document.aliases=[{id:second,alias_type:'local_name',alias:'Second',language_tag:'en'},{id:type,alias_type:'local_name',alias:'第一',language_tag:'zh'}];
    record.document.types=[{shop_type_id:type,is_primary:false},{shop_type_id:second,is_primary:true}];
    const custom=`type_${second.replaceAll('-','_')}`;
    const preview=projectSavedShopPreview(record,{...options,types:[...options.types!,{id:second,code:custom,label:'Custom shop'}],localities:[{id:second,label:'Singapore (SG)',countryCode:'SG'}]})!;
    expect(preview).toMatchObject({primaryType:custom,localityName:'Singapore',localName:'第一',shopTypes:[custom,'fountain_pen_specialist'],links:[{url:'https://example.test/',isOfficial:true}]});
  });
  it('refuses incomplete location/type instead of inventing facts',()=>{
    const record=fixture(); record.document.shop.latitude=null;
    expect(projectSavedShopPreview(record,options)).toBeNull();
    record.document.shop.latitude=0;
    expect(projectSavedShopPreview(record,{...options,types:[]})).toBeNull();
  });
});

it('uses canonical option order, not relationship insertion order, with primary type first',()=>{
  const record=fixture(),second='61000000-0000-4000-8000-000000000003';
  record.document.specialties=[{specialty_id:second},{specialty_id:type}];
  const result=projectSavedShopPreview(record,{...options,specialties:[{id:type,code:'a',label:'First canonical'},{id:second,code:'z',label:'Last canonical'}]})!;
  expect(result.specialties).toEqual(['First canonical','Last canonical']);
  expect(result.specialtyLine).toBe('First canonical');
});
