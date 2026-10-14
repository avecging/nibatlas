import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { usePassportView } from './use-passport-view';
import { passportViewStorageKey, EMPTY_PASSPORT_VIEW, type PassportViewRecord } from './passport-view-state';

const accountMemory=vi.hoisted(()=>({current:{mode:null,place:null,coverSeen:false,listScrollTop:0} as PassportViewRecord,
  read(){return this.current;}, write(value:PassportViewRecord){this.current=value;}
}));
vi.mock('@/src/features/collection/collection-store',()=>({useCollection:()=>({scope:'normal',source:'account',passportViewMemory:accountMemory})}));
vi.mock('@/src/features/reviewer/ReviewerModeProvider',()=>({useReviewerModeStore:()=>({reviewer:false,resolved:true})}));
function Probe(){const view=usePassportView();return <><output data-testid="ready">{String(view.hydrated)}</output><output data-testid="place">{JSON.stringify(view.place)}</output><output data-testid="scroll">{view.listScrollTop}</output>
  <button onClick={()=>{view.chooseMode('book');view.rememberPlace({kind:'locality',countryCode:'JP',localitySlug:'private-locality',collectionId:'private-impression'});view.rememberListScrollTop(780);}}>Remember</button></>;}
beforeEach(()=>{window.localStorage.clear();accountMemory.current=EMPTY_PASSPORT_VIEW;});
it('persists mode but keeps account geography in memory only',async()=>{
  render(<Probe/>);await waitFor(()=>expect(screen.getByTestId('ready')).toHaveTextContent('true'));
  fireEvent.click(screen.getByRole('button',{name:'Remember'}));
  expect(screen.getByTestId('place')).toHaveTextContent('private-locality');
  const stored=window.localStorage.getItem(passportViewStorageKey('normal'));
  expect(stored).toContain('book');expect(stored).not.toContain('private-locality');expect(stored).not.toContain('JP');
  expect(stored).not.toContain('780');
});
it('restores private page and scroll memory after route unmounts, but not after owner disposal',async()=>{
  const first=render(<Probe/>);await waitFor(()=>expect(screen.getByTestId('ready')).toHaveTextContent('true'));
  fireEvent.click(screen.getByRole('button',{name:'Remember'}));first.unmount();
  const returning=render(<Probe/>);await waitFor(()=>expect(screen.getByTestId('ready')).toHaveTextContent('true'));
  expect(screen.getByTestId('place')).toHaveTextContent('private-impression');expect(screen.getByTestId('scroll')).toHaveTextContent('780');
  returning.unmount();accountMemory.current=EMPTY_PASSPORT_VIEW;
  render(<Probe/>);await waitFor(()=>expect(screen.getByTestId('ready')).toHaveTextContent('true'));
  expect(screen.getByTestId('place')).toHaveTextContent('null');expect(screen.getByTestId('scroll')).toHaveTextContent('0');
});
