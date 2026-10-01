import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SealAdmin} from './SealAdmin';
import {SealEditor} from './SealEditor';
const id='e1000000-0000-4000-8000-000000000002';
const replace=vi.fn();
vi.mock('next/navigation',()=>({useRouter:()=>({replace})}));
vi.mock('@/src/features/account/AccountSessionProvider',()=>({useAccountSession:()=>({session:{status:'signed-in',userId:'e1000000-0000-4000-8000-000000000001'}})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
const draft={scope:'country',countryCode:'SG',countryLabel:'Singapore',localityId:null,ink:'teal',eligibleShopIds:[],name:'Singapore country',origin:'generated'};
const entry={id,revision:id,draft,localityName:null,published:true,publishedVersion:2};
it('shows a paginated dashboard with scope and separate editor links',async()=>{
 const fetch=vi.fn(async(input:string)=>{expect(input).toContain('/api/v1/admin/seals');return Response.json({entries:[entry],nextCursor:id});});vi.stubGlobal('fetch',fetch);render(<SealAdmin/>);
 expect(await screen.findByText('Singapore country')).toBeVisible();expect(screen.getByRole('columnheader',{name:'Scope'})).toBeVisible();expect(screen.getByText('v2')).toBeVisible();
 expect(screen.getByRole('link',{name:'Add new seal'})).toHaveAttribute('href','/admin/seals/new');expect(screen.getByRole('link',{name:/Edit Singapore country/})).toHaveAttribute('href',`/admin/seals/${id}`);
 expect(screen.queryByRole('button',{name:'Save privately'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Next'}));await waitFor(()=>expect(fetch.mock.calls.length).toBe(2));expect(String(fetch.mock.calls[1]?.[0])).toContain(`after=${id}`);
});
it('searches the server so matches beyond the loaded page are findable',async()=>{
 const fetch=vi.fn(async(input:string)=>{expect(input).toContain('/api/v1/admin/seals');return Response.json({entries:[],nextCursor:null});});vi.stubGlobal('fetch',fetch);render(<SealAdmin/>);await screen.findByText('No seals match these filters.');
 fireEvent.change(screen.getByLabelText('Search seals'),{target:{value:'Tokyo'}});fireEvent.change(screen.getByLabelText('Scope'),{target:{value:'locality'}});fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));
 await waitFor(()=>expect(fetch.mock.calls.length).toBe(2));expect(String(fetch.mock.calls[1]?.[0])).toContain('q=Tokyo&scope=locality');
});
it('loads a separate editor, saves before publishing and shows immutable version history',async()=>{
 const actions:string[]=[];let saved=entry;
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  if(input.endsWith('/options'))return Response.json({localities:[],types:[],services:[],specialties:[],brands:[]});
  if(input.includes('history=1'))return Response.json({entries:[{version:1,snapshot:{...draft,name:'Original design',origin:'commissioned',creatorName:'Artist',creatorUrl:'https://example.com',ink:'navy',localityName:null,localitySlug:null,template:'cartouche-v1',eligibleShops:[]}}],nextBefore:null});
  if(!init?.body)return Response.json({seal:saved});
  const b=JSON.parse(String(init.body));actions.push(b.action);saved={...saved,draft:b.document??saved.draft};return Response.json({seal:saved});
 }));
 render(<SealEditor id={id}/>);await screen.findByLabelText('Name');
 expect(screen.queryByText('Find eligible shop')).toBeNull();fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Updated country seal'}});
 expect(screen.getByRole('button',{name:'Publish saved seal'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Save privately'}));await waitFor(()=>expect(actions).toEqual(['save']));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Publish saved seal'})).toBeEnabled());fireEvent.click(screen.getByRole('tab',{name:'Version history'}));
 expect(await screen.findByText('Original design')).toBeVisible();expect(screen.getByRole('link',{name:'https://example.com'})).toHaveAttribute('href','https://example.com');expect(screen.getByText('navy')).toBeVisible();
});
it('explains a mislabeled JPEG and keeps saved details for a replacement upload',async()=>{
 const actions:string[]=[];
 const saved={...entry,draft:{...draft,origin:'founder_created'},published:false,publishedVersion:null};
 let uploads=0;
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  if(input.endsWith('/options'))return Response.json({localities:[],types:[],services:[],specialties:[],brands:[]});
  if(input.endsWith('/artwork')){uploads++;return uploads===1?Response.json({error:'jpeg_artwork_not_supported'},{status:422}):Response.json({id});}
  if(!init?.body)return Response.json({seal:saved});
  const body=JSON.parse(String(init.body));actions.push(body.action);saved.draft=body.document;return Response.json({seal:saved});
 }));
 render(<SealEditor id={id}/>);await screen.findByLabelText('Name');
 const picker=screen.getByLabelText('Seal artwork');
 fireEvent.change(picker,{target:{files:[new File([new Uint8Array([0xff,0xd8,0xff])],'mislabeled.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'Save privately'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('This file contains a JPEG image');
 expect(screen.getByRole('alert')).toHaveTextContent('renaming it is not enough');
 expect(screen.getByLabelText('Name')).toHaveValue('Singapore country');
 expect(screen.getByRole('button',{name:'Publish saved seal'})).toBeDisabled();
 fireEvent.change(picker,{target:{files:[new File(['replacement'],'exported.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'Save privately'}));
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Saved privately. Publish when ready.'));
 expect(uploads).toBe(2);expect(actions).toEqual(['save','save','save']);
 expect(screen.getByRole('button',{name:'Publish saved seal'})).toBeEnabled();
});
it('previews selected ink, requires saving legacy artwork, and keeps historical rendering original',async()=>{
 const artId='e1000000-0000-4000-8000-000000000003';
 const original={...draft,origin:'founder_created',artworkId:artId};
 let saved={...entry,draft:original};const documents:Record<string,unknown>[]=[];
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  if(input.endsWith('/options'))return Response.json({localities:[],types:[],services:[],specialties:[],brands:[]});
  if(input.includes('history=1'))return Response.json({entries:[{version:1,snapshot:{...original,localityName:null,localitySlug:null,template:'cartouche-v1',eligibleShops:[]}}],nextBefore:null});
  if(!init?.body)return Response.json({seal:saved});
  const body=JSON.parse(String(init.body));documents.push(body.document);saved={...saved,draft:body.document};return Response.json({seal:saved});
 }));
 render(<SealEditor id={id}/>);await screen.findByLabelText('Name');
 expect(screen.getByRole('img')).toHaveAttribute('src',`/api/v1/seals/artwork/${artId}?ink=teal`);
 expect(screen.getByRole('button',{name:'Publish saved seal'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Discard unsaved changes'}));
 expect(screen.getByRole('img')).toHaveAttribute('src',`/api/v1/seals/artwork/${artId}`);
 fireEvent.change(screen.getByLabelText('Ink'),{target:{value:'plum'}});
 expect(screen.getByRole('img')).toHaveAttribute('src',`/api/v1/seals/artwork/${artId}?ink=plum`);
 fireEvent.click(screen.getByRole('button',{name:'Save privately'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Publish saved seal'})).toBeEnabled());
 expect(documents[0]).toMatchObject({ink:'plum',artworkTreatment:'ink-v1'});
 fireEvent.click(screen.getByRole('tab',{name:'Version history'}));await screen.findByText('Version 1');
 expect(screen.getByRole('img')).toHaveAttribute('src',`/api/v1/seals/artwork/${artId}`);
});
