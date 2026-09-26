// @vitest-environment jsdom
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SelectedPreviewReceiver } from './SelectedPreviewReceiver';
const id='61000000-0000-4000-8000-000000000001', revision='a'.repeat(32);
const selection={shopId:id,revision,fingerprint:'b'.repeat(64),photos:[],logo:null,stamp:null};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function setup() {
  const parent={postMessage:vi.fn()} as unknown as Window;
  vi.stubGlobal('parent',parent);
  const view=render(<SelectedPreviewReceiver id={id} revision={revision} userId="one">{value=><p>Accepted {value.fingerprint}</p>}</SelectedPreviewReceiver>);
  const send=(data:unknown,source:Window=parent,origin=window.location.origin)=>act(()=>window.dispatchEvent(new MessageEvent('message',{data,source,origin})));
  return {parent,view,send};
}
it('accepts one bounded selection from only the exact parent and same origin',()=>{
  const {parent,send}=setup();
  expect(parent.postMessage).toHaveBeenCalledWith({type:'nibatlas-preview-ready'},window.location.origin);
  const data={type:'nibatlas-preview-selection',userId:'one',selection};
  send(data,window);send(data,parent,'https://wrong.test');send({...data,type:'wrong'});
  expect(screen.queryByText(/^Accepted/)).toBeNull();
  send(data);expect(screen.getByText(/^Accepted/)).toHaveTextContent(selection.fingerprint);
  send({...data,selection:{...selection,fingerprint:'c'.repeat(64)}});
  expect(screen.getByText(/^Accepted/)).toHaveTextContent(selection.fingerprint);
});
it.each([
  {userId:'two'}, {selection:{...selection,shopId:'61000000-0000-4000-8000-000000000002'}},
  {selection:{...selection,revision:'c'.repeat(32)}},{selection:{...selection,photos:['bad']}},
])('refuses account, shop, revision or malformed intents %j',patch=>{
  const {send}=setup();send({type:'nibatlas-preview-selection',userId:'one',selection,...patch});
  expect(screen.getByRole('alert')).toHaveTextContent('unavailable');expect(screen.queryByText(/^Accepted/)).toBeNull();
});
it('does not request or consume a selection in a standalone window',()=>{
  vi.stubGlobal('parent',window);
  render(<SelectedPreviewReceiver id={id} revision={revision} userId="one">{()=> <p>Accepted</p>}</SelectedPreviewReceiver>);
  act(()=>window.dispatchEvent(new MessageEvent('message',{origin:window.location.origin,source:window,data:{type:'nibatlas-preview-selection',userId:'one',selection}})));
  expect(screen.queryByText(/^Accepted/)).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('Review section');
});
