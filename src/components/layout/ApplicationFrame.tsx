'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import { AccountSessionProvider } from '@/src/features/account/AccountSessionProvider';
import { SignInProvider } from '@/src/features/auth/SignInProvider';
import { CatalogueProvider } from '@/src/features/catalogue/CatalogueProvider';
import { CollectionProvider } from '@/src/features/collection/collection-store';
import { ReviewerModeProvider } from '@/src/features/reviewer/ReviewerModeProvider';
import { SavedShopsProvider } from '@/src/features/saved/SavedShopsProvider';
import styles from './AppShell.module.css';

export function ApplicationFrame({children}: {children:ReactNode}) {
  const path = usePathname() ?? '/';
  if (/^\/admin\/shops\/[^/]+\/preview$/.test(path)) {
    // A review must not import device-local saves, resume account actions, or
    // load collections just because it mounts in a second browser document.
    return <AccountSessionProvider><main id="main-content" className={`${styles.main} ${styles.mainContentVariant}`}>{children}</main></AccountSessionProvider>;
  }
  return <ReviewerModeProvider><AccountSessionProvider><SignInProvider>
    <CatalogueProvider><CollectionProvider>
      {/* Account saves layer over the unchanged device-local collection. */}
      <SavedShopsProvider><AppShell>{children}</AppShell></SavedShopsProvider>
    </CollectionProvider></CatalogueProvider>
  </SignInProvider></AccountSessionProvider></ReviewerModeProvider>;
}
