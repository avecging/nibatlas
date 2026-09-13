import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifiedCollection } from './VerifiedCollection';
import { CollectionProvider, useCollection } from '@/src/features/collection/collection-store';
import { CatalogueProvider } from '@/src/features/catalogue/CatalogueProvider';
import { ReviewerModeProvider } from '@/src/features/reviewer/ReviewerModeProvider';
import { prototypeShopDetails } from '@/src/fixtures/prototype-catalogue';
import { ISSUED_STAMP, STAMP_OWNER } from '@/src/test/stamp';
import type { AccountSession } from '@/src/features/account/account-session';
import type { StampFailureCode } from '@/src/api/v1/stamp-verification';

const account=vi.hoisted(()=>({session:{status:'signed-in',userId:'10000000-0000-4000-8000-000000000051',displayName:null,identityLabel:'fixture@example.test'} as AccountSession,refresh:vi.fn()}));
const requestSignIn=vi.hoisted(()=>vi.fn());
vi.mock('@/src/features/account/AccountSessionProvider',()=>({useAccountSession:()=>account}));
vi.mock('@/src/features/auth/SignInProvider',()=>({useSignInPrompt:()=>({requestSignIn})}));
const shop={...prototypeShopDetails[0]!,id:ISSUED_STAMP.shopId,slug:ISSUED_STAMP.shopSlug,name:'Current Demo Name'};
let rows: unknown[];
let calls:{action:string;body:Record<string,unknown>}[];
let verifyFailure:StampFailureCode|null;
let nonceFailure:StampFailureCode|null;
let collectFailure:StampFailureCode|null;
let nonceCount:number;
let readFailure:boolean;
function Probe({showAction=true}:{showAction?:boolean}){const store=useCollection();return <><output data-testid="count">{store.passport.stampCount}</output><output data-testid="visited">{String(store.isVisited(shop.id))}</output><output data-testid="seals">{store.seals.length}</output>{showAction ? <VerifiedCollection shop={shop}/>:null}</>;}
function App({showAction=true}:{showAction?:boolean}){return <ReviewerModeProvider><CatalogueProvider mode="api"><CollectionProvider><Probe showAction={showAction}/></CollectionProvider></CatalogueProvider></ReviewerModeProvider>;}
beforeEach(()=>{
  window.localStorage.clear();window.history.replaceState({},'','/shops/m3-api-demo-shop');
  rows=[];calls=[];nonceCount=0;verifyFailure=null;nonceFailure=null;collectFailure=null;readFailure=false;
  account.session={status:'signed-in',userId:STAMP_OWNER,identityLabel:'fixture@example.test',displayName:null};
  requestSignIn.mockClear();
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:vi.fn((success:PositionCallback)=>success({coords:{latitude:1,longitude:2,accuracy:100}} as GeolocationPosition))}});
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
    if(input.startsWith('/api/v1/collections')) return readFailure ? Response.json({}, {status:503}) : Response.json({ownerId:STAMP_OWNER,collections:rows,nextCursor:null});
    const action=input.split('/').at(-1)!;
    const body=JSON.parse(String(init?.body)) as Record<string,unknown>;
    calls.push({action,body});
    if(action==='nonce') {nonceCount++;if(nonceFailure) return Response.json({ok:false,error:{code:nonceFailure}});return Response.json(rows.length ? {ok:true,status:'duplicate',collection:rows[0]} : {ok:true,status:'nonce_issued',requestId:STAMP_OWNER,nonce:String(nonceCount).padStart(64,'0')});}
    if(action==='verify') return Response.json(verifyFailure ? {ok:false,error:{code:verifyFailure}} : {ok:true,status:'confirmation_required'});
    if(collectFailure) return Response.json({ok:false,error:{code:collectFailure}});
    rows=[ISSUED_STAMP];return Response.json({ok:true,status:'success',collection:ISSUED_STAMP});
  }));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
async function open(){const view=render(<App/>);fireEvent.click(await screen.findByRole('button',{name:'Collect Stamp'}));await screen.findByRole('button',{name:'Check my location'});return view;}
async function verify(){fireEvent.click(screen.getByRole('button',{name:'Check my location'}));await screen.findByRole('button',{name:'I am at this shop'});}
function deferIssuance(){
  const original=fetch;
  const responses:((response:Response)=>void)[]=[];
  vi.stubGlobal('fetch',vi.fn((input:string,init?:RequestInit)=>input.endsWith('/collect')
    ? new Promise<Response>(resolve=>responses.push(resolve)) : original(input,init)));
  return responses;
}

describe('verified collection journey',()=>{
  it('does not request location before consent or issue before confirmation; updates shared state once',async()=>{
    await open();expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    await verify();expect(calls.map(c=>c.action)).toEqual(['nonce','verify']);expect(screen.getByTestId('count')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    const ceremony=await screen.findByTestId('stamp-ceremony');
    expect(ceremony).toHaveTextContent('Historical Demo Shop');expect(ceremony).toHaveTextContent('2026-09-12');
    expect(ceremony).not.toHaveTextContent('preview impression');
    await waitFor(()=>expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(screen.getByTestId('visited')).toHaveTextContent('true');expect(screen.getByTestId('seals')).toHaveTextContent('0');
    expect(calls[2]?.body).toEqual({shopId:shop.id,requestId:STAMP_OWNER,nonce:'1'.padStart(64,'0'),confirmedAtShop:true});
    expect(JSON.stringify(window.localStorage)).not.toContain('Historical Demo Shop');
    expect(JSON.stringify(window.localStorage)).not.toContain('latitude');
  });
  it('opens a duplicate without another geolocation check or press',async()=>{
    rows=[ISSUED_STAMP];render(<App/>);
    fireEvent.click(await screen.findByRole('button',{name:'View Atlas Stamp'}));
    expect(await screen.findByText('Already in your Passport')).toBeInTheDocument();
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
  it('permits one immediate poor-accuracy retry with a new nonce',async()=>{
    verifyFailure='poor_accuracy';await open();fireEvent.click(screen.getByRole('button',{name:'Check my location'}));
    fireEvent.click(await screen.findByRole('button',{name:'Try again'}));
    await screen.findByText(/A second reading was still unclear/);
    expect(screen.queryByRole('button',{name:'Try again'})).not.toBeInTheDocument();
    expect(nonceCount).toBe(2);expect(calls.filter(c=>c.action==='collect')).toHaveLength(0);
    expect(calls[1]?.body['nonce']).not.toBe(calls[3]?.body['nonce']);
  });
  it('offers only retry and cancel outside the area, with fresh verification before confirmation',async()=>{
    verifyFailure='outside_radius';await open();fireEvent.click(screen.getByRole('button',{name:'Check my location'}));
    await screen.findByRole('alert');
    const dialog=within(screen.getByRole('dialog'));
    expect(dialog.getAllByRole('button').map(button=>button.textContent)).toEqual(['Try again','Cancel']);
    expect(dialog.queryAllByRole('link')).toHaveLength(0);
    verifyFailure=null;
    fireEvent.click(dialog.getByRole('button',{name:'Try again'}));
    await screen.findByRole('button',{name:'I am at this shop'});
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(calls.map(c=>c.action)).toEqual(['nonce','verify','nonce','verify']);
    expect(calls[1]?.body['nonce']).not.toBe(calls[3]?.body['nonce']);
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some(c=>c.action==='collect')).toBe(false);
  });
  it.each(['service_unavailable','reused_nonce'] as const)('keeps Passport recovery after an issuance request returns %s',async(code)=>{
    collectFailure=code;await open();await verify();fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    expect(await screen.findByRole('link',{name:'Check Passport'})).toHaveAttribute('href','/passport');
    expect(screen.getByRole('link',{name:'Get help with collection'})).toBeInTheDocument();
  });
  it.each(['permission_denied','outside_radius','stale_position','expired_nonce','reused_nonce','throttled','shop_unavailable','service_unavailable','invalid_request'] as const)('shows %s without issuing',async(code)=>{
    verifyFailure=code;await open();fireEvent.click(screen.getByRole('button',{name:'Check my location'}));
    expect(await screen.findByRole('alert')).not.toHaveTextContent(/150|100|radius|metres|threshold/i);
    expect(calls.some(c=>c.action==='collect')).toBe(false);
    expect(screen.queryByRole('link',{name:'Check Passport'})).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent(/Passport/);
  });
  it('keeps a nonce failure at the shop without requesting location or Passport recovery',async()=>{
    nonceFailure='service_unavailable';await open();fireEvent.click(screen.getByRole('button',{name:'Check my location'}));
    expect(await screen.findByRole('alert')).not.toHaveTextContent(/Passport/);
    expect(screen.queryByRole('link',{name:'Check Passport'})).not.toBeInTheDocument();
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(calls.map(c=>c.action)).toEqual(['nonce']);
  });
  it('retains uncertain issuance recovery across cancel and a later failed check',async()=>{
    collectFailure='service_unavailable';await open();await verify();
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    await screen.findByRole('link',{name:'Check Passport'});
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    fireEvent.click(screen.getByRole('button',{name:'Collect Stamp'}));
    nonceFailure='service_unavailable';
    fireEvent.click(screen.getByRole('button',{name:'Check my location'}));
    expect(await screen.findByRole('link',{name:'Check Passport'})).toBeInTheDocument();
    expect(calls.map(c=>c.action)).toEqual(['nonce','verify','collect','nonce']);
  });
  it('refreshes Passport when a lost response committed after the first empty reconciliation',async()=>{
    collectFailure='service_unavailable';await open();await verify();
    const original=fetch;
    let reads=0;
    vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
      const response=await original(input,init);
      if (input.startsWith('/api/v1/collections')) reads++;
      return response;
    }));
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    const recovery=await screen.findByRole('link',{name:'Check Passport'});
    await waitFor(()=>expect(reads).toBe(1));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    rows=[ISSUED_STAMP];
    // Routing is covered by integration; keep this unit test's provider mounted.
    recovery.addEventListener('click',event=>event.preventDefault(),{once:true});
    fireEvent.click(recovery);
    await waitFor(()=>expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(screen.queryByTestId('stamp-ceremony')).not.toBeInTheDocument();
  });
  it.each(['throttled','expired_nonce'] as const)('keeps an explicit issuance refusal (%s) at the shop',async(code)=>{
    collectFailure=code;await open();await verify();
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    expect(await screen.findByRole('alert')).not.toHaveTextContent(/Passport/);
    expect(screen.queryByRole('link',{name:'Check Passport'})).not.toBeInTheDocument();
  });
  it.each(['Cancel','Escape'] as const)('reconciles an already committed stamp when %s closes the dialog',async(control)=>{
    await open();await verify();
    const original=fetch;
    let finish!:(response:Response)=>void;
    vi.stubGlobal('fetch',vi.fn((input:string,init?:RequestInit)=>{
      if (!input.endsWith('/collect')) return original(input,init);
      rows=[ISSUED_STAMP];
      return new Promise<Response>(resolve=>{finish=resolve;});
    }));
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    await within(screen.getByRole('dialog')).findByRole('status');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    if (control === 'Cancel') fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    else fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(()=>expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(screen.getByRole('button',{name:'View Atlas Stamp'})).toBeInTheDocument();
    await act(async()=>finish(Response.json({ok:true,status:'success',collection:ISSUED_STAMP})));
    expect(screen.queryByTestId('stamp-ceremony')).not.toBeInTheDocument();
  });
  it.each(['Cancel','Escape','navigate','sign out','lost response'] as const)('handles issuance committed after cancellation and %s',async(control)=>{
    const view=await open();await verify();
    const original=fetch;
    let finish!:(response:Response)=>void;
    let issuanceSignal:AbortSignal|null|undefined;
    let reads=0;
    vi.stubGlobal('fetch',vi.fn((input:string,init?:RequestInit)=>{
      if (input.startsWith('/api/v1/collections')) reads++;
      if (!input.endsWith('/collect')) return original(input,init);
      issuanceSignal=init?.signal;
      return new Promise<Response>(resolve=>{finish=resolve;});
    }));
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    await within(screen.getByRole('dialog')).findByRole('status');
    if (control === 'Escape') fireEvent.keyDown(document,{key:'Escape'});
    else fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    await waitFor(()=>expect(reads).toBe(1));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(issuanceSignal?.aborted).toBe(false);
    if (control === 'navigate') view.rerender(<App showAction={false}/>);
    if (control === 'sign out') {account.session={status:'signed-out'};view.rerender(<App/>);}
    await act(async()=>{
      rows=[ISSUED_STAMP];
      finish(control === 'lost response' ? Response.json({}, {status:503})
        : Response.json({ok:true,status:'success',collection:ISSUED_STAMP}));
    });
    await waitFor(()=>expect(screen.getByTestId('count')).toHaveTextContent(control === 'sign out' ? '0':'1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stamp-ceremony')).not.toBeInTheDocument();
  });
  it.each(['throttled','expired_nonce','invalid_request'] as const)('clears a detached %s refusal before a later failed location check',async(code)=>{
    await open();await verify();const responses=deferIssuance();
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    await act(async()=>responses[0]!(Response.json({ok:false,error:{code}})));
    fireEvent.click(screen.getByRole('button',{name:'Collect Stamp'}));
    nonceFailure='service_unavailable';
    fireEvent.click(screen.getByRole('button',{name:'Check my location'}));
    expect(await screen.findByRole('alert')).not.toHaveTextContent(/Passport/);
    expect(screen.queryByRole('link',{name:'Check Passport'})).not.toBeInTheDocument();
  });
  it('does not let an older detached refusal clear a newer uncertain issuance',async()=>{
    await open();await verify();const responses=deferIssuance();
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    fireEvent.click(screen.getByRole('button',{name:'Collect Stamp'}));await verify();
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    await act(async()=>responses[0]!(Response.json({ok:false,error:{code:'expired_nonce'}})));
    await act(async()=>responses[1]!(Response.json({ok:false,error:{code:'service_unavailable'}})));
    expect(await screen.findByRole('link',{name:'Check Passport'})).toBeInTheDocument();
  });
  it('settles detached refusals arriving in reverse order',async()=>{
    await open();const responses=deferIssuance();
    for(let attempt=0;attempt<2;attempt++){
      await verify();fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
      fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
      if (attempt === 0) fireEvent.click(screen.getByRole('button',{name:'Collect Stamp'}));
    }
    await act(async()=>responses[1]!(Response.json({ok:false,error:{code:'throttled'}})));
    await act(async()=>responses[0]!(Response.json({ok:false,error:{code:'expired_nonce'}})));
    fireEvent.click(screen.getByRole('button',{name:'Collect Stamp'}));nonceFailure='service_unavailable';
    fireEvent.click(screen.getByRole('button',{name:'Check my location'}));
    expect(await screen.findByRole('alert')).not.toHaveTextContent(/Passport/);
    expect(screen.queryByRole('link',{name:'Check Passport'})).not.toBeInTheDocument();
  });
  it('offers reconciliation when an issuance response is interrupted by backgrounding',async()=>{
    await open();await verify();
    const original=fetch;
    vi.stubGlobal('fetch',vi.fn((input:string,init?:RequestInit)=>input.endsWith('/collect')
      ? new Promise<Response>((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new Error('aborted'))))
      : original(input,init)));
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    await within(screen.getByRole('dialog')).findByRole('status');
    act(()=>{vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');document.dispatchEvent(new Event('visibilitychange'));});
    expect(await screen.findByRole('link',{name:'Check Passport'})).toBeInTheDocument();
    expect(screen.queryByTestId('stamp-ceremony')).not.toBeInTheDocument();
  });
  it.each(['navigation','sign-out','backgrounding'] as const)('settles a late issuance after direct %s without pressing Cancel',async(interruption)=>{
    const view=await open();await verify();const responses=deferIssuance();
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));
    if (interruption === 'navigation') view.rerender(<App showAction={false}/>);
    else if (interruption === 'sign-out') {account.session={status:'signed-out'};view.rerender(<App/>);}
    else act(()=>{vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');document.dispatchEvent(new Event('visibilitychange'));});
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    await act(async()=>{
      rows=[ISSUED_STAMP];
      responses[0]!(Response.json({ok:true,status:'success',collection:ISSUED_STAMP}));
    });
    await waitFor(()=>expect(screen.getByTestId('count')).toHaveTextContent(interruption === 'sign-out' ? '0':'1'));
    expect(screen.queryByTestId('stamp-ceremony')).not.toBeInTheDocument();
  });
  it('sends denial without coordinates',async()=>{
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_success:PositionCallback,error:PositionErrorCallback)=>error({code:1} as GeolocationPositionError)}});
    verifyFailure='permission_denied';await open();fireEvent.click(screen.getByRole('button',{name:'Check my location'}));
    await screen.findByRole('alert');expect(calls[1]?.body).toMatchObject({permission:'denied'});expect(calls[1]?.body).not.toHaveProperty('position');
  });
  it('invalidates verification on hide before explicit confirmation',async()=>{
    await open();await verify();
    act(()=>{vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');document.dispatchEvent(new Event('visibilitychange'));});
    await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'I am at this shop'})).not.toBeInTheDocument();
    expect(calls.some(c=>c.action==='collect')).toBe(false);
    expect(screen.queryByRole('link',{name:'Check Passport'})).not.toBeInTheDocument();
  });
  it('clears private impressions and active dialogs on sign-out',async()=>{
    rows=[ISSUED_STAMP];const view=render(<App/>);
    fireEvent.click(await screen.findByRole('button',{name:'View Atlas Stamp'}));await screen.findByTestId('stamp-ceremony');
    account.session={status:'signed-out'};view.rerender(<App/>);
    await waitFor(()=>expect(screen.queryByTestId('stamp-ceremony')).not.toBeInTheDocument());
    expect(screen.getByTestId('count')).toHaveTextContent('0');expect(screen.getByTestId('visited')).toHaveTextContent('false');
  });
  it('returns sign-in to preflight without requesting location',async()=>{
    account.session={status:'signed-out'};render(<App/>);
    fireEvent.click(await screen.findByRole('button',{name:'Collect Stamp'}));
    expect(requestSignIn).toHaveBeenCalledWith(expect.objectContaining({intent:{type:'collect-shop',shopSlug:shop.slug},returnTo:expect.stringContaining('collect=1')}));
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
  it('keeps an issued impression when a reconciliation read fails',async()=>{
    await open();await verify();readFailure=true;
    fireEvent.click(screen.getByRole('button',{name:'I am at this shop'}));await screen.findByTestId('stamp-ceremony');
    await waitFor(()=>expect(screen.getByTestId('count')).toHaveTextContent('1'));
    fireEvent.click(within(screen.getByTestId('stamp-ceremony')).getByRole('button',{name:'Back to shop'}));
    expect(screen.getByRole('button',{name:'View Atlas Stamp'})).toBeInTheDocument();
  });
});
