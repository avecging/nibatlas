'use client';
import { useState } from 'react';
import type { ShopRecord } from './shop-contract';
import styles from './ShopAdmin.module.css';

export function PublicPreviewFrame({record,width}: {record:ShopRecord;width:'mobile'|'desktop'}) {
  const [attempt,setAttempt] = useState(0);
  return <>
    <p className={styles.help}>Saved shop content in the public layout, with currently approved photos and logo. Unsaved edits and private image choices are excluded. Links and account actions are inactive; nearby suggestions and the future review date are omitted. Stamp artwork is reviewed in the Stamp section.</p>
    <button type="button" onClick={() => setAttempt(n => n+1)}>Refresh preview</button>
    <div className={styles.previewScroll} role="region" aria-label={`${width === 'mobile' ? 'Mobile' : 'Desktop'} preview viewport`} tabIndex={0}>
      <iframe key={`${record.id}:${record.revision}:${attempt}`} title="Saved public-page preview"
        className={styles.previewFrame} style={{width:width === 'mobile' ? 360 : 1280}}
        src={`/admin/shops/${record.id}/preview?revision=${encodeURIComponent(record.revision)}`}/>
    </div>
    <p className={styles.help}>{width === 'mobile' ? '360' : '1280'} px viewport. Scroll inside the preview to inspect the page; on a narrow screen, scroll sideways to inspect the desktop layout.</p>
  </>;
}
