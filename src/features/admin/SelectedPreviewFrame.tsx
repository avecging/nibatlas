'use client';
import { useEffect, useRef, useState } from 'react';
import { useAccountSession } from '@/src/features/account/AccountSessionProvider';
import type { PreviewSelection } from './preview-selection';
import styles from './ShopAdmin.module.css';

/** Pass only bounded identifiers/fingerprint to this exact same-origin frame.
 * No selected/private content enters URLs, browser storage or initial HTML. */
export function SelectedPreviewFrame({selection}: {selection: PreviewSelection}) {
  const [width, setWidth] = useState<'mobile' | 'desktop'>('mobile');
  const [attempt, setAttempt] = useState(0);
  const {session} = useAccountSession();
  const userId = session.status === 'signed-in' ? session.userId : null;
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!userId || event.origin !== window.location.origin || event.source !== frame.current?.contentWindow
        || event.data?.type !== 'nibatlas-preview-ready') return;
      frame.current?.contentWindow?.postMessage({type:'nibatlas-preview-selection', userId, selection}, window.location.origin);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [selection, userId]);
  return <section aria-label="Selected public-page and stamp preview">
    <h4>Selected public-page and stamp preview</h4>
    <p className={styles.help}>Saved shop content with your selected images. The collection artwork appears separately because the public shop header has no stamp. This temporary preview does not approve or publish these choices.</p>
    <div className={styles.toggle} role="group" aria-label="Selected preview width">
      {(['mobile','desktop'] as const).map(value => <button key={value} type="button" aria-pressed={width === value} onClick={() => { setWidth(value); if (viewport.current) viewport.current.scrollLeft = 0; }}>{value === 'mobile' ? 'Selected mobile' : 'Selected desktop'}</button>)}
    </div>
    <button type="button" onClick={() => setAttempt(n => n + 1)}>Refresh selected preview</button>
    {userId && <div ref={viewport} className={styles.previewScroll} role="region" aria-label="Selected preview viewport" tabIndex={0}>
      <iframe ref={frame} key={`${userId}:${JSON.stringify(selection)}:${attempt}`} title="Selected public-page preview"
        className={styles.previewFrame} style={{width:width === 'mobile' ? 360 : 1280}}
        src={`/admin/shops/${selection.shopId}/preview?revision=${encodeURIComponent(selection.revision)}&mode=selection`}/>
    </div>}
    <p className={styles.help}>{width === 'mobile' ? 360 : 1280} px viewport. Scroll inside to inspect the page and artwork. Refresh checks these same choices; if they are stale, reload the media comparison and choose again.</p>
  </section>;
}
