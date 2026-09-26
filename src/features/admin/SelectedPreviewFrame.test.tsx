// @vitest-environment jsdom
import { cleanup, render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SelectedPreviewFrame } from './SelectedPreviewFrame';
const identity=vi.hoisted(()=>({session:{status:'signed-in',userId:'one'}}));
vi.mock('@/src/features/account/AccountSessionProvider',()=>({useAccountSession:()=>identity}));
const selection={shopId:'61000000-0000-4000-8000-000000000001',revision:'a'.repeat(32),fingerprint:'b'.repeat(64),photos:['61000000-0000-4000-8000-000000000002'],logo:null,stamp:null};
afterEach(()=>{cleanup();identity.session={status:'signed-in',userId:'one'};});
it('sends intent only to its exact same-origin iframe after readiness, never through URLs',()=>{
  render(<SelectedPreviewFrame selection={selection}/>);
  const frame=screen.getByTitle('Selected public-page preview') as HTMLIFrameElement;
  const post=vi.spyOn(frame.contentWindow!,'postMessage');
  const send=(source:Window,origin=window.location.origin)=>act(()=>window.dispatchEvent(new MessageEvent('message',{source,origin,data:{type:'nibatlas-preview-ready'}})));
  send(window);send(frame.contentWindow!,'https://wrong.test');expect(post).not.toHaveBeenCalled();
  send(frame.contentWindow!);
  expect(post).toHaveBeenCalledWith({type:'nibatlas-preview-selection',userId:'one',selection},window.location.origin);
  expect(frame.src).not.toContain(selection.photos[0]);expect(frame.src).not.toContain(selection.fingerprint);
  fireEvent.click(screen.getByRole('button',{name:'Selected desktop'}));expect(screen.getByTitle('Selected public-page preview')).toBe(frame);
});
it('remounts for new choices and drops the frame on sign-out',()=>{
  const view=render(<SelectedPreviewFrame selection={selection}/>);
  const old=screen.getByTitle('Selected public-page preview');
  view.rerender(<SelectedPreviewFrame selection={{...selection,photos:[]}}/>);
  expect(screen.getByTitle('Selected public-page preview')).not.toBe(old);
  identity.session={status:'signed-out',userId:''};view.rerender(<SelectedPreviewFrame selection={selection}/>);
  expect(screen.queryByTitle('Selected public-page preview')).toBeNull();
});
