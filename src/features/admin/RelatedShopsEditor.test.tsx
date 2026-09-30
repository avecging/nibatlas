import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RelatedShopsEditor, branchNameAdvisory } from './RelatedShopsEditor';
import { normalizeShopDocument, ShopValidationError } from './shop-normalization';
import { document, type Row } from './shop-contract';
const a='b1000000-0000-4000-8000-000000000010',b='b1000000-0000-4000-8000-000000000020';
const shop={id:b,name:'Synthetic North',slug:'synthetic-north',publicationStatus:'published',operationalStatus:'open',hasChanges:false};
afterEach(()=>vi.unstubAllGlobals());
function Harness({nearby=false}:{nearby?:boolean}) {
 const [rows,setRows]=useState<Row[]>(nearby?[{shop_id:b,kind:'branch',show_public:false}]:[]);
 return <RelatedShopsEditor id={a} name="Synthetic South" rows={rows} change={setRows} errors={[]}
  context={{nearbyIds:nearby?[b]:[],shops:[{...shop,localityName:'Kobe',countryCode:'JP'}]}}/>;
}
it('searches, adds, changes the shared label and per-side display, removes without a modal',async()=>{
 const fetch=vi.fn(async()=>new Response(JSON.stringify({entries:[shop],nextCursor:null})));vi.stubGlobal('fetch',fetch);
 render(<Harness/>);fireEvent.change(screen.getByLabelText('Find an existing shop'),{target:{value:'Synthetic'}});
 fireEvent.click(screen.getByRole('button',{name:'Search shops'}));fireEvent.click(await screen.findByRole('button',{name:'Add Synthetic North'}));
 expect(screen.getByRole('combobox')).toHaveValue('related');
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'branch'}});
 fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByRole('checkbox')).toBeChecked();
 expect(screen.queryByText(/names look different/)).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Remove'}));expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(1);
 expect(fetch.mock.calls[0]).toBeDefined();
});
it('disables Nearby duplicates and offers a keyboard/tap disclosure',()=>{
 render(<Harness nearby/>);expect(screen.getByRole('checkbox')).toBeDisabled();expect(screen.getByRole('checkbox')).not.toBeChecked();
 expect(screen.getByText(/public display stays off/)).toBeInTheDocument();
 expect(screen.getByLabelText('Why public display is unavailable for Synthetic North').tagName).toBe('SUMMARY');
});
it('ignores location suffixes while advising on unrelated business names',()=>{
 expect(branchNameAdvisory('LAMY 313 Somerset','LAMY Jewel')).toBe(false);
 expect(branchNameAdvisory('Think Funan','Cityluxe')).toBe(true);
});
it('preserves omitted relationships and validates supplied rows',()=>{
 const base={shop:{name:'Synthetic',slug:'synthetic',source_quality:'demo',operational_status:'unknown',position_precision:'locality'},sources:[],aliases:[],links:[],types:[],services:[],specialties:[],brands:[],experiences:[]};
 expect(normalizeShopDocument(base)).not.toHaveProperty('related_shops');
 const doc=normalizeShopDocument({...base,related_shops:[{shop_id:b.toUpperCase(),kind:'branch',show_public:'false'}]});
 expect(doc.related_shops).toEqual([{shop_id:b,kind:'branch',show_public:false}]);
 expect(document(doc)).toEqual(doc);
 expect(()=>normalizeShopDocument({...doc,related_shops:[...doc.related_shops!,...doc.related_shops!]})).toThrow(ShopValidationError);
 expect(()=>normalizeShopDocument({...doc,related_shops:[{shop_id:b,kind:'chain',show_public:true}]})).toThrow(ShopValidationError);
 expect(()=>normalizeShopDocument({...doc,related_shops:[{shop_id:'bogus',kind:'branch',show_public:true}]})).toThrow(ShopValidationError);
});
