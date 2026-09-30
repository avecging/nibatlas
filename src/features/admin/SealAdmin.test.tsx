import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SealAdmin} from './SealAdmin';
vi.mock('@/src/features/account/AccountSessionProvider',()=>({useAccountSession:()=>({session:{status:'signed-in',userId:'e1000000-0000-4000-8000-000000000001'}})}));
afterEach(()=>vi.unstubAllGlobals());
it('loads existing localities and saves privately before publication',async()=>{
 const id='e1000000-0000-4000-8000-000000000002';const actions:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  if(input.endsWith('/options'))return Response.json({localities:[{id,label:'Singapore',countryCode:'SG'}],types:[],services:[],specialties:[],brands:[]});
  if(!init?.body)return Response.json({entries:[],nextCursor:null});
  const b=JSON.parse(String(init.body));actions.push(b.action);return Response.json({seal:{id,revision:id,draft:b.document,localityName:'Singapore',published:false,publishedVersion:null}});
 }));
 render(<SealAdmin/>);
 const locality=await screen.findByLabelText('Locality',{exact:true});
 fireEvent.change(locality,{target:{value:id}});
 fireEvent.click(screen.getByRole('button',{name:'Save privately'}));
 await waitFor(()=>expect(actions).toEqual(['save']));
 expect(await screen.findByRole('button',{name:'Publish saved seal'})).toBeEnabled();
});
