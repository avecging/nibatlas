// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApplicationFrame } from './ApplicationFrame';
const route=vi.hoisted(()=>({path:'/'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.path}));
vi.mock('./AppShell',()=>({AppShell:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('@/src/features/account/AccountSessionProvider',()=>({AccountSessionProvider:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('@/src/features/auth/SignInProvider',()=>({SignInProvider:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('@/src/features/catalogue/CatalogueProvider',()=>({CatalogueProvider:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('@/src/features/collection/collection-store',()=>({CollectionProvider:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('@/src/features/reviewer/ReviewerModeProvider',()=>({ReviewerModeProvider:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('@/src/features/saved/SavedShopsProvider',()=>({SavedShopsProvider:({children}:{children:ReactNode})=><div data-testid="automatic-save-import-provider">{children}</div>}));
afterEach(cleanup);
it.each(['61000000-0000-4000-8000-00000000000a','61000000-0000-4000-8000-00000000000A','invalid-id'])('keeps every preview route outside automatic save import: %s',(id)=>{
  route.path=`/admin/shops/${id}/preview`;render(<ApplicationFrame>Preview shell</ApplicationFrame>);
  expect(screen.getByText('Preview shell')).toBeTruthy();expect(screen.queryByTestId('automatic-save-import-provider')).toBeNull();
});
it('retains normal providers on editor and public shop routes',()=>{
  route.path='/admin/shops/61000000-0000-4000-8000-000000000001';render(<ApplicationFrame>Editor</ApplicationFrame>);
  expect(screen.getByTestId('automatic-save-import-provider')).toBeTruthy();
});
