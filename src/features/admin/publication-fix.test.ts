import {expect,it} from 'vitest';
import {publicationFix} from './publication-fix';
import {document} from './shop-contract';
const draft=document({shop:{name:'Synthetic',slug:'synthetic',source_quality:'demo',operational_status:'unknown',position_precision:'street',country_code:'SG',locality_id:'82000000-0000-4000-8000-000000000001',latitude:0,longitude:0},sources:[],aliases:[],links:[],types:[],services:[],specialties:[],brands:[]});
it('targets the missing geography field and accepts zero coordinates',()=>{
 expect(publicationFix('Add country, locality, timezone and valid coordinates.',draft)).toEqual({path:'shop.timezone'});
});
it('position and artwork requirements lead to the actual action',()=>{
 expect(publicationFix('Check and confirm the saved shop position.',draft)).toEqual({id:'confirm-shop-position'});
 expect(publicationFix('Prepare an active Atlas Stamp with approved artwork (artwork package).',draft)).toEqual({id:'shop-stamp-artwork'});
});
