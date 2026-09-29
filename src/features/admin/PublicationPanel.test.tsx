// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { PublicationPanel } from './PublicationPanel';
import type { Publication } from './publication-contract';
const id='61000000-0000-4000-8000-000000000001';
const review={id,choices:{photos:[id],logo:id,stamp:id}};
const outcome=(partial=false):Publication=>({reviewId:id,status:partial?'partial':'complete',canRetry:partial,updatedAt:'2026-09-29T00:00:00Z',outcomes:[
 {kind:'shop',targetId:id,status:'succeeded',reason:null},{kind:'stamp',targetId:id,status:'succeeded',reason:null},
 {kind:'photo',targetId:id,status:partial?'failed':'succeeded',reason:partial?'unavailable':null},
 {kind:'logo',targetId:id,status:'succeeded',reason:null}]});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function mock({lost=false,partial=false}:{lost?:boolean;partial?:boolean}={}) {
 let saved:Publication|null=null;
 const fetch=vi.fn(async(_url:string,init?:RequestInit)=>{
  if(init?.method==='POST') {const body=JSON.parse(String(init.body));saved=outcome(partial&&body.action==='publish');if(lost)throw Error('Lost response');}
  return Response.json({publication:saved});
 });vi.stubGlobal('fetch',fetch);return fetch;
}
it('requires a separate confirmation and publishes only the saved review ID',async()=>{
 const fetch=mock();render(<PublicationPanel shop={id} review={review} disabled={false}/>);
 const button=screen.getByRole('button',{name:'Publish reviewed shop and choices'});await waitFor(()=>expect(button).toBeEnabled());
 fireEvent.click(button);expect(fetch).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole('button',{name:'Cancel publication'}));expect(fetch).toHaveBeenCalledTimes(1);
 fireEvent.click(button);fireEvent.click(screen.getByRole('button',{name:'Yes, publish these reviewed choices'}));
 await screen.findByText('Publication complete.');expect(JSON.parse(String(fetch.mock.calls[1]![1]!.body))).toEqual({action:'publish',reviewId:id});expect(button).toBeDisabled();
});
it('restores a lost-response outcome by read without republishing',async()=>{
 const fetch=mock({lost:true});render(<PublicationPanel shop={id} review={review} disabled={false}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Publish reviewed shop and choices'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Publish reviewed shop and choices'}));fireEvent.click(screen.getByRole('button',{name:'Yes, publish these reviewed choices'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Check the outcome before trying again.');expect(screen.getByRole('button',{name:'Publish reviewed shop and choices'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Check publication outcome'}));await screen.findByText('Publication complete.');
 expect(fetch.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
});
it('shows partial results and explicitly retries unfinished parts',async()=>{
 const fetch=mock({partial:true});render(<PublicationPanel shop={id} review={review} disabled={false}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Publish reviewed shop and choices'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Publish reviewed shop and choices'}));fireEvent.click(screen.getByRole('button',{name:'Yes, publish these reviewed choices'}));
 await screen.findByText('Partly published.');expect(screen.getByText(/Selected photo 1: Failed/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Retry unfinished parts'}));fireEvent.click(screen.getByRole('button',{name:'Yes, retry unfinished parts'}));
 await screen.findByText('Publication complete.');expect(JSON.parse(String(fetch.mock.calls[2]![1]!.body))).toEqual({action:'retry',reviewId:id});
});
it.each([null,review])('blocks publication without current review or with unsaved work',async selected=>{
 mock();render(<PublicationPanel shop={id} review={selected} disabled={true}/>);
 await waitFor(()=>expect(screen.queryByText('Checking publication…')).toBeNull());
 expect(screen.getByRole('button',{name:'Publish reviewed shop and choices'})).toBeDisabled();
});
it('keeps stale retry blocked and tells the admin to review again',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({publication:{...outcome(true),canRetry:false}})));
 render(<PublicationPanel shop={id} review={null} disabled={false}/>);await screen.findByText('Partly published.');
 expect(screen.queryByRole('button',{name:'Retry unfinished parts'})).toBeNull();expect(screen.getByText(/Saved content or the review changed/)).toBeVisible();
});
