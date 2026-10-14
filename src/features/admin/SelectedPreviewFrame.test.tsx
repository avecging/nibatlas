// @vitest-environment jsdom
import { cleanup, render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useLayoutEffect } from 'react';
import type { PreviewSelection } from './preview-selection';
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
  const viewport=screen.getByRole('region',{name:'Selected preview viewport'});
  viewport.scrollLeft=200;
  fireEvent.click(screen.getByRole('button',{name:'Selected desktop'}));expect(screen.getByTitle('Selected public-page preview')).toBe(frame);
  expect(viewport.scrollLeft).toBe(0);
});
it('remounts for new choices and drops the frame on sign-out',()=>{
  const view=render(<SelectedPreviewFrame selection={selection}/>);
  const old=screen.getByTitle('Selected public-page preview');
  view.rerender(<SelectedPreviewFrame selection={{...selection,photos:[]}}/>);
  expect(screen.getByTitle('Selected public-page preview')).not.toBe(old);
  identity.session={status:'signed-out',userId:''};view.rerender(<SelectedPreviewFrame selection={selection}/>);
  expect(screen.queryByTitle('Selected public-page preview')).toBeNull();
});

it('answers a replacement frame with current choices before passive effects flush',()=>{
  const sent: unknown[]=[];
  function Harness({value}:{value:PreviewSelection}) {
    useLayoutEffect(()=>{
      const frame=screen.getByTitle('Selected public-page preview') as HTMLIFrameElement;
      const child=frame.contentWindow!;
      const post=vi.spyOn(child,'postMessage').mockImplementation(message=>{sent.push(message);});
      // Child layout effects have committed, but parent passive-effect cleanup
      // has not run. Reproduce readiness in that old-listener/new-frame window.
      window.dispatchEvent(new MessageEvent('message',{source:child,origin:window.location.origin,data:{type:'nibatlas-preview-ready'}}));
      return ()=>post.mockRestore();
    },[value]);
    return <SelectedPreviewFrame selection={value}/>;
  }
  const view=render(<Harness value={selection}/>);
  sent.length=0;
  const changed={...selection,photos:[]};
  view.rerender(<Harness value={changed}/>);
  expect(sent).toEqual([{type:'nibatlas-preview-selection',userId:'one',selection:changed}]);
});
