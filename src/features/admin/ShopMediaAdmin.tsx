'use client';
/* eslint-disable @next/next/no-img-element -- Private authenticated previews cannot use an image proxy. */
import { readAdminResponse } from './read-response';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeShopMedia, mediaCapabilities, mediaPath, type ShopMedia } from './media-contract';
import { usePendingUpload } from './use-pending-upload';
import { UUID } from './shop-contract';
import styles from './ShopMediaAdmin.module.css';

export interface MediaSummary {
  total: number;
  published: number;
}

const messages: Record<string,string> = {
  invalid_upload:'This file is not supported. Photos: ordinary RGB JPEG or PNG. Logos: RGB/RGBA PNG. PNG must be non-interlaced, at most 2048 px per side, without text or EXIF metadata.',
  invalid_request:'That action is not available on this deployment yet. Nothing was changed.',
  authentication_required:'Sign in again to continue.', forbidden:'Your account cannot perform this media action. Publishing, hiding and removing an image need an admin account.',
  service_unavailable:'Media service is unavailable. Your file was not lost — try again.',
  upload_expired:'This upload expired. Choose the file again to start a fresh upload.', upload_conflict:'Choose the file again to start a fresh upload.',
  revision_conflict:'This image changed in another session. Reload images before trying again.',
  invalid_media_target:'The shop or upload changed. Reload images and try again.',
  media_limit:'This shop has reached the 50-image limit.', upload_limit:'The daily upload limit has been reached.',
};
class MediaFailure extends Error {
  constructor(readonly code: string) { super(messages[code] ?? 'The operation failed. Reload images to check their saved state.'); }
}
async function call(path: string, signal: AbortSignal, options: RequestInit = {}) {
  const response = await fetch(path,{...options,signal,cache:'no-store',credentials:'same-origin'});
  const value = await readAdminResponse(response, !!options.method && options.method !== 'GET');
  if (!response.ok) throw new MediaFailure(value.error?.code ?? 'service_unavailable');
  return value;
}
const post = (value: unknown): RequestInit => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});

type Pending = {entry: ShopMedia; action: 'publish' | 'hide' | 'remove'};

export function ShopMediaAdmin({shopId,shopName,published,archived,onSummary}: {
  shopId:string;shopName:string;published:boolean;archived:boolean;onSummary?:(summary:MediaSummary)=>void;
}) {
  const [entries,setEntries] = useState<ShopMedia[]>([]), [capabilities,setCapabilities] = useState<string[]>([]);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [loaded,setLoaded] = useState(false), [notice,setNotice] = useState('');
  const [confirmation,setConfirmation] = useState<Pending | null>(null);
  const controller = useRef<AbortController | null>(null), lock = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  const path = mediaPath(shopId);

  const apply = useCallback((value: {entries?: unknown}) => {
    const rows = decodeShopMedia(value.entries,true);
    setEntries(rows);
    setCapabilities(mediaCapabilities(value));
    return rows;
  },[]);

  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);
  useEffect(() => {
    if (!loaded || !onSummary) return;
    onSummary({total:entries.length,published:entries.filter(e => e.status === 'approved').length});
  },[entries,loaded,onSummary]);

  useEffect(() => {
    const c = new AbortController(); controller.current = c;
    call(path,c.signal).then(r => {apply(r);setLoaded(true);}).catch(e => {if (!c.signal.aborted) setError(e.message);});
    return () => c.abort();
  },[path,apply]);

  async function run(work: (signal:AbortSignal) => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const signal = controller.current!.signal;
    try { await work(signal); }
    catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : 'Media operation failed.'); }
    finally { lock.current = false; if (!signal.aborted) setBusy(false); }
  }

  const canRemove = capabilities.includes('remove');
  const photos = entries.filter(e => e.kind === 'photo'), logos = entries.filter(e => e.kind === 'logo');
  const live = entries.filter(e => e.status === 'approved').length;

  return <section className={styles.section} aria-label="Shop photos and logo">
    <p className={styles.lead}>
      Every image has two states. <strong>Private</strong> means saved to this draft and visible only to editors.
      {' '}<strong>On the public page</strong> means an admin has shown it. Saving or publishing the shop never
      {' '}publishes an image by itself.
      {published ? '' : ' This shop is not published, so nothing here is public yet.'}
    </p>
    <div ref={feedback} tabIndex={-1} className={styles.feedback}>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <p role="status" aria-live="polite">{notice || (busy ? 'Working…' : loaded ? `${entries.length} saved · ${live} on the public page` : 'Loading images…')}</p>
    </div>

    <div className={styles.columns}>
      {(['photo','logo'] as const).map(kind => {
        const rows = kind === 'photo' ? photos : logos;
        return <div key={kind}>
          <h3>{kind === 'photo' ? 'Shop photos' : 'Shop logo'}</h3>
          <UploadPicker kind={kind} shopId={shopId} shopName={shopName} disabled={busy || archived || !loaded} run={run} saved={value => {
            apply(value); setNotice(`Saved privately. Review the preview, then choose “Show on public page” when it is right.`);
          }}/>
          {loaded && !rows.length ? <p className={styles.help}>No {kind === 'photo' ? 'photos' : 'logo'} saved yet.</p> : null}
          {rows.map((entry,index) => <figure className={styles.card} key={entry.id}>
            <img className={kind === 'logo' ? styles.logo : styles.photo} src={`${path}/${entry.id}`} alt={entry.altText} width={entry.width} height={entry.height}/>
            <figcaption>
              <span className={entry.status === 'approved' ? styles.statePublic : styles.statePrivate}>
                {entry.status === 'approved' ? 'On the public page' : 'Private to this draft'}
              </span>
              <span className={styles.meta}>
                {kind === 'logo' ? 'Logo' : `Photo ${index + 1}`} · {entry.width}×{entry.height}
                {entry.creditText ? ` · ${entry.creditText}` : ''}
              </span>
            </figcaption>
            <div className={styles.cardActions}>
              <button type="button" disabled={busy || archived} onClick={() => setConfirmation({entry,action:entry.status === 'approved' ? 'hide' : 'publish'})}>
                {entry.status === 'approved' ? 'Remove from public page' : 'Show on public page'}
              </button>
              {canRemove && <button type="button" className={styles.danger} disabled={busy || archived}
                onClick={() => setConfirmation({entry,action:'remove'})}>Delete image</button>}
            </div>
          </figure>)}
        </div>;
      })}
    </div>

    {loaded && !canRemove && <p className={styles.help}>
      <strong>Deleting an image is not available on this deployment yet.</strong> “Remove from the public page”
      {' '}takes an image off the live listing straight away and keeps it in this draft. Permanent deletion needs the
      {' '}media removal action described in <code>docs/api/admin-b3-contract-handoff.md</code>; the control appears here
      {' '}automatically once that ships.
    </p>}

    <button type="button" className={styles.quiet} disabled={busy} onClick={() => void run(async signal => {
      apply(await call(path,signal)); setLoaded(true); setConfirmation(null); setNotice('Images reloaded.');
    })}>Reload images</button>

    {confirmation && <MediaDialog pending={confirmation} shopName={shopName} published={published} busy={busy}
      onCancel={() => setConfirmation(null)}
      onConfirm={() => void run(async signal => {
        const r = await call(path,signal,post({action:confirmation.action,id:confirmation.entry.id,revision:confirmation.entry.revision}));
        apply(r);
        setNotice(confirmation.action === 'publish'
          ? (published ? 'Now on the public page. Open the public shop page to check it.' : 'Marked for the public page. It appears once the shop itself is published.')
          : confirmation.action === 'hide' ? 'Taken off the public page. It is still saved in this draft.'
          : 'Image deleted.');
        setConfirmation(null);
      })}/>}
  </section>;
}

function MediaDialog({pending,shopName,published,busy,onCancel,onConfirm}: {
  pending:Pending;shopName:string;published:boolean;busy:boolean;onCancel:()=>void;onConfirm:()=>void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown',key);
    return () => document.removeEventListener('keydown',key);
  },[onCancel]);
  const live = pending.entry.status === 'approved';
  const copy = pending.action === 'publish'
    ? {title:`Show this ${pending.entry.kind} on the public page?`,
       body:`${published ? `It becomes visible to everyone on ${shopName}'s public page straight away.` : `${shopName} is not published yet, so it becomes visible when the shop is published.`}${pending.entry.kind === 'logo' ? ' It replaces the current public logo; the old logo stays saved in this draft.' : ''}`,
       verb:'Show on public page'}
    : pending.action === 'hide'
      ? {title:'Remove this image from the public page?',
         body:'It comes off the live listing immediately and stays saved in this draft, so you can show it again later.',
         verb:'Remove from public page'}
      : {title:'Delete this image?',
         body:`${live ? 'It is currently on the public page: deleting removes it from the live listing and from this draft.' : 'It is private, so this affects this draft only.'} Deleting cannot be undone from this interface.`,
         verb:'Delete image'};
  return <div className={styles.scrim} onMouseDown={onCancel}>
    <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-label={copy.title} onMouseDown={e => e.stopPropagation()}>
      <h3>{copy.title}</h3>
      <p>{copy.body}</p>
      <div className={styles.dialogActions}>
        <button autoFocus type="button" disabled={busy} className={pending.action === 'remove' ? styles.danger : undefined} onClick={onConfirm}>
          {busy ? 'Working…' : copy.verb}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  </div>;
}

function UploadPicker({kind,shopId,shopName,disabled,run,saved}: {
  kind:'photo'|'logo';shopId:string;shopName:string;disabled:boolean;
  run:(work:(signal:AbortSignal)=>Promise<void>)=>Promise<void>;saved:(value:{entries?:unknown})=>void;
}) {
  const [file,setFile] = useState<File | null>(null), [preview,setPreview] = useState(''), [error,setError] = useState('');
  const [failed,setFailed] = useState(false);
  const session = useRef<string | null>(null), input = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); },[preview]);
  usePendingUpload(!!file);
  const save = (file: File) => void run(async signal => {
        setFailed(false);
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
        saved(r);setFile(null);setPreview('');session.current = null;
        if (input.current) input.current.value = '';
        } catch (e) {
          if (e instanceof MediaFailure && ['upload_expired','upload_conflict'].includes(e.code)) session.current = null;
          // The chosen file stays on screen with a retry, so nothing has to be found again.
          setFailed(true);
          throw e;
        }

  });
  const label = kind === 'logo' ? 'logo' : 'photo';
  return <div className={styles.picker}>
    <label className={styles.fileLabel}>Choose a {label}
      <input ref={input} type="file" accept={kind === 'logo' ? 'image/png' : 'image/png,image/jpeg'} disabled={disabled} onChange={e => {
      setPreview('');setError('');setFailed(false);session.current = null;
      const f = e.target.files?.[0] ?? null;
      if (f && (f.size < 1 || f.size > 5*1024*1024 || !(f.type === 'image/png' || (kind === 'photo' && f.type === 'image/jpeg')))) {
        setFile(null); setError('Choose a supported file up to 5 MiB. Logos use PNG; photos use PNG or JPEG.'); return;
      }
      setFile(f);
      if (f) { setPreview(URL.createObjectURL(f)); save(f); }
    }}/></label>
    <p className={styles.help}>{kind === 'logo' ? 'PNG, up to 5 MiB and 2048 px per side. Transparent backgrounds are preserved.' : 'JPEG or PNG, up to 5 MiB. JPEG: up to 24 MP / 8192 px per side. PNG: up to 2048 px per side.'} Choosing a file saves it privately straight away.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {file && preview && <div className={styles.pendingUpload}>
      <img className={kind === 'logo' ? styles.logo : styles.photo} src={preview} alt={`Selected ${label} for ${shopName}`}/>
      <p>{file.name} · {failed ? 'not saved' : 'saving…'}</p>
      {failed && <button type="button" disabled={disabled} onClick={() => save(file)}>Retry saving this {label}</button>}
      {failed && <button type="button" className={styles.quiet} onClick={() => {
        setFile(null);setPreview('');setFailed(false);session.current = null;
        if (input.current) input.current.value = '';
      }}>Discard this file</button>}
    </div>}
  </div>;
}
