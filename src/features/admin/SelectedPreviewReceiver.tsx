'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { decodePreviewSelection, type PreviewSelection } from './preview-selection';

/** The parent supplies intent, never trusted media data or authorization. */
export function SelectedPreviewReceiver({id, revision, userId, children}: {
  id: string; revision: string; userId: string; children: (selection: PreviewSelection) => ReactNode;
}) {
  const [result, setResult] = useState<{selection?: PreviewSelection; error?: string} | null>(null);
  useEffect(() => {
    let received = false;
    const receive = (event: MessageEvent) => {
      if (received || window.parent === window || event.source !== window.parent || event.origin !== window.location.origin
        || event.data?.type !== 'nibatlas-preview-selection') return;
      received = true;
      try {
        const selection = decodePreviewSelection(event.data.selection);
        if (event.data.userId !== userId || selection.shopId !== id || selection.revision !== revision) throw Error();
        setResult({selection});
      } catch { setResult({error:'These preview choices are unavailable. Reopen the preview from Review.'}); }
    };
    window.addEventListener('message', receive);
    if (window.parent !== window) window.parent.postMessage({type:'nibatlas-preview-ready'}, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, [id, revision, userId]);
  if (result?.error) return <p role="alert">{result.error}</p>;
  return result?.selection ? children(result.selection) : <p role="status">Open the selected preview from the shop’s Review section.</p>;
}
