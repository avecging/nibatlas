import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { usePassportView } from './use-passport-view';
import { passportViewStorageKey } from './passport-view-state';

vi.mock('@/src/features/collection/collection-store',()=>({useCollection:()=>({scope:'normal',source:'account'})}));
vi.mock('@/src/features/reviewer/ReviewerModeProvider',()=>({useReviewerModeStore:()=>({reviewer:false,resolved:true})}));
function Probe(){const view=usePassportView();return <><output data-testid="ready">{String(view.hydrated)}</output><output data-testid="place">{JSON.stringify(view.place)}</output>
  <button onClick={()=>{view.chooseMode('book');view.rememberPlace({kind:'locality',countryCode:'JP',localitySlug:'private-locality',collectionId:'private-impression'});}}>Remember</button></>;}
beforeEach(()=>window.localStorage.clear());
it('persists mode but keeps account geography in memory only',async()=>{
  render(<Probe/>);await waitFor(()=>expect(screen.getByTestId('ready')).toHaveTextContent('true'));
  fireEvent.click(screen.getByRole('button',{name:'Remember'}));
  expect(screen.getByTestId('place')).toHaveTextContent('private-locality');
  const stored=window.localStorage.getItem(passportViewStorageKey('normal'));
  expect(stored).toContain('book');expect(stored).not.toContain('private-locality');expect(stored).not.toContain('JP');
});
