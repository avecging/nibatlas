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
 fireEvent.click(screen.getByRole('button',{name:'Search shops'}));fireEvent.click(await screen.findByRole('checkbox',{name:/Synthetic North/}));
 fireEvent.click(screen.getByRole('button',{name:'Add selected (1)'}));
 expect(screen.getByRole('combobox')).toHaveValue('branch');
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'related'}});
 fireEvent.click(screen.getByRole('checkbox',{name:'Show on this shop’s public page'}));expect(screen.getByRole('checkbox',{name:'Show on this shop’s public page'})).toBeChecked();
 expect(screen.queryByText(/names look different/)).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Remove'}));expect(screen.queryByRole('checkbox',{name:'Show on this shop’s public page'})).not.toBeInTheDocument();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(1);
 expect(fetch.mock.calls[0]).toBeDefined();
});
it('lets an editor show a linked shop even when it is nearby',()=>{
 render(<Harness nearby/>);
 const checkbox=screen.getByRole('checkbox',{name:'Show on this shop’s public page'});
 expect(checkbox).toBeEnabled();fireEvent.click(checkbox);expect(checkbox).toBeChecked();
});
it('adds multiple selected shops in one action',async()=>{
 const second={...shop,id:'b1000000-0000-4000-8000-000000000030',name:'Synthetic West',slug:'synthetic-west'};
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({entries:[shop,second],nextCursor:null}))));
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Search shops'}));
 fireEvent.click(await screen.findByRole('checkbox',{name:/Synthetic North/}));
 fireEvent.click(screen.getByRole('checkbox',{name:/Synthetic West/}));
 fireEvent.click(screen.getByRole('button',{name:'Add selected (2)'}));
 expect(screen.getAllByRole('checkbox',{name:'Show on this shop’s public page'})).toHaveLength(2);
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
