'use client';
/* eslint-disable @next/next/no-img-element -- Private authenticated previews cannot use an image proxy. */
import { readAdminResponse } from './read-response';
import { useEffect, useRef, useState } from 'react';
import { decodeShopMedia, mediaPath, type ShopMedia } from './media-contract';
import { usePendingUpload } from './use-pending-upload';
import { UUID } from './shop-contract';
import styles from './ShopMediaAdmin.module.css';
const messages: Record<string,string> = {
  invalid_upload:'This file is not supported. Photos: ordinary RGB JPEG or PNG. Logos: RGB/RGBA PNG. PNG must be non-interlaced, at most 2048 px per side, without text or EXIF metadata.',
  invalid_request:'Check the file format and try again.',
  authentication_required:'Sign in again to continue.', forbidden:'Your account cannot perform this media action.',
  service_unavailable:'Media service is unavailable. Try again.',
  upload_expired:'This upload expired. Save again to start a fresh upload.', upload_conflict:'Save again to start a fresh upload.',
  revision_conflict:'This image changed in another session. Reload media before trying again.',
  invalid_media_target:'The shop or upload changed. Reload media and try again.',
  media_limit:'This shop has reached the 50-image limit.', upload_limit:'The daily upload limit has been reached.',
};
class MediaFailure extends Error {
  constructor(readonly code: string) { super(messages[code] ?? 'The operation failed. Reload media to check its saved state.'); }
}
async function call(path: string, signal: AbortSignal, options: RequestInit = {}) {
  const response = await fetch(path,{...options,signal,cache:'no-store',credentials:'same-origin'});
  const value = await readAdminResponse(response, !!options.method && options.method !== 'GET');
  if (!response.ok) throw new MediaFailure(value.error?.code ?? 'service_unavailable');
  return value;
}
const post = (value: unknown): RequestInit => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
export function ShopMediaAdmin({shopId,shopName,archived}: {shopId:string;shopName:string;archived:boolean}) {
  const [entries,setEntries] = useState<ShopMedia[]>([]), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [loaded,setLoaded] = useState(false), [notice,setNotice] = useState('');
  const [confirmation,setConfirmation] = useState<{entry:ShopMedia;action:'publish'|'hide'} | null>(null);
  const controller = useRef<AbortController | null>(null), lock = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error || notice) { feedback.current?.focus(); feedback.current?.scrollIntoView({block:'center'}); } }, [error, notice]);
  const path = mediaPath(shopId);
  useEffect(() => {
    const c = new AbortController(); controller.current = c;
    call(path,c.signal).then(r => {setEntries(decodeShopMedia(r.entries,true));setLoaded(true);}).catch(e => {if (!c.signal.aborted) setError(e.message);});
    return () => c.abort();
  },[path]);
  async function run(work: (signal:AbortSignal) => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const signal = controller.current!.signal;
    try { await work(signal); }
    catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : 'Media operation failed.'); }
    finally { lock.current = false; if (!signal.aborted) setBusy(false); }
  }
  return <section className={styles.section} aria-label="Shop photos and logo">
    <h2>Photos and logo</h2>
    <p>Upload for <strong>{shopName}</strong>. Choosing a file uploads and saves it privately. Publish when the saved preview looks right. Published media appears only while the shop is public.</p>
    <div ref={feedback} tabIndex={-1}>{error && <p role="alert">{error}</p>}
    <p role="status" aria-live="polite">{notice || (busy ? 'Uploading and saving privately…' : '')}</p></div>
    <button type="button" disabled={busy} onClick={() => void run(async signal => {
      setEntries(decodeShopMedia((await call(path,signal)).entries,true)); setLoaded(true); setConfirmation(null); setNotice('Media reloaded.');
    })}>Reload media</button>
    <div className={styles.columns}>
      {(['photo','logo'] as const).map(kind => <div key={kind}>
        <h3>{kind === 'photo' ? 'Shop photos' : 'Shop logo'}</h3>
        <UploadPicker kind={kind} shopId={shopId} shopName={shopName} disabled={busy || archived || !loaded} run={run} saved={rows => {
          setEntries(rows); setNotice('Saved privately. Review the saved preview below before publishing.');
        }}/>
        {entries.filter(e => e.kind === kind).map((entry,index) => <figure className={styles.card} key={entry.id}>
          <img className={kind === 'logo' ? styles.logo : styles.photo} src={`${path}/${entry.id}`} alt={entry.altText} width={entry.width} height={entry.height}/>
          <figcaption>{kind === 'logo' ? 'Logo' : 'Photo'} {index + 1} · {entry.status === 'approved' ? 'Published when shop is public' : 'Private'}{entry.creditText ? ` · ${entry.creditText}` : ''}</figcaption>
          <button type="button" disabled={busy || archived} onClick={() => setConfirmation({entry,action:entry.status === 'approved' ? 'hide' : 'publish'})}>
            {entry.status === 'approved' ? 'Hide' : 'Publish'} {kind} {index + 1}
          </button>
        </figure>)}
      </div>)}
    </div>
    {confirmation && <div className={styles.confirmation} role="group" aria-label="Confirm media publication">
      <p>{confirmation.action === 'publish' ? `Publish this ${confirmation.entry.kind} for ${shopName}?${confirmation.entry.kind === 'logo' ? ' It will replace the current public logo. The old logo stays saved.' : ''}` : 'Hide this image from the public shop page?'}</p>
      <button type="button" disabled={busy} onClick={() => void run(async signal => {
        const r = await call(path,signal,post({action:confirmation.action,id:confirmation.entry.id,revision:confirmation.entry.revision}));
        setEntries(decodeShopMedia(r.entries,true));setNotice(confirmation.action === 'publish' ? 'Media published. It is visible when the shop is public.' : 'Media is now private.');setConfirmation(null);
      })}>Confirm {confirmation.action}</button>
      <button type="button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
    </div>}
  </section>;
}
function UploadPicker({kind,shopId,shopName,disabled,run,saved}: {
  kind:'photo'|'logo';shopId:string;shopName:string;disabled:boolean;
  run:(work:(signal:AbortSignal)=>Promise<void>)=>Promise<void>;saved:(rows:ShopMedia[])=>void;
}) {
  const [file,setFile] = useState<File | null>(null), [preview,setPreview] = useState(''), [error,setError] = useState('');
  const session = useRef<string | null>(null), input = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); },[preview]);
  usePendingUpload(!!file);
  const save = (file: File) => void run(async signal => {
        try {
        const bytes = await file.arrayBuffer();
        const base = '/api/v1/admin/media/uploads';
        if (!session.current) {
          const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b => b.toString(16).padStart(2,'0')).join('');
          const r = await call(base,signal,post({shopId,purpose:kind === 'logo' ? 'shop_logo' : 'shop_photo',sha256,byteSize:file.size,contentType:file.type}));
          if (typeof r.id !== 'string' || !UUID.test(r.id)) throw new MediaFailure('service_unavailable');
          session.current = r.id;
        }
        const url = `${base}/${session.current}`;
        // A retry first recovers a lost PUT/finalization response without reprocessing JPEG.
        try { await call(url,signal,{method:'POST'}); }
        catch (e) {
          if (!(e instanceof MediaFailure) || e.code !== 'upload_incomplete') throw e;
          await call(url,signal,{method:'PUT',headers:{'Content-Type':file.type},body:bytes});
          await call(url,signal,{method:'POST'});
        }
        const r = await call(mediaPath(shopId),signal,post({action:'attach',id:session.current}));
        saved(decodeShopMedia(r.entries,true));setFile(null);setPreview('');session.current = null;
        if (input.current) input.current.value = '';
        } catch (e) {
          if (e instanceof MediaFailure && ['upload_expired','upload_conflict'].includes(e.code)) session.current = null;
          throw e;
        }

  });
  return <div>
    <label>Choose {kind}<input ref={input} type="file" accept={kind === 'logo' ? 'image/png' : 'image/png,image/jpeg'} disabled={disabled} onChange={e => {
      setPreview('');setError('');session.current = null;
      const f = e.target.files?.[0] ?? null;
      if (f && (f.size < 1 || f.size > 5*1024*1024 || !(f.type === 'image/png' || (kind === 'photo' && f.type === 'image/jpeg')))) {
        setFile(null); setError('Choose a supported file up to 5 MiB. Logos use PNG; photos use PNG or JPEG.'); return;
      }
      setFile(f);
      if (f) { setPreview(URL.createObjectURL(f)); save(f); }
    }}/></label>
    <p className={styles.help}>{kind === 'logo' ? 'PNG, up to 5 MiB and 2048 px per side. Transparent backgrounds are preserved.' : 'JPEG or PNG, up to 5 MiB. JPEG: up to 24 MP / 8192 px per side. PNG: up to 2048 px per side.'}</p>
    {error && <p role="alert">{error}</p>}
    {file && preview && <>
      <img className={kind === 'logo' ? styles.logo : styles.photo} src={preview} alt={`Selected ${kind} for ${shopName}`}/>
      <p>{file.name} · Not saved yet</p>
      <button type="button" disabled={disabled} onClick={() => save(file)}>Save {kind} privately</button>
    </>}
  </div>;
}
