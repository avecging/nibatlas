'use client';
/* eslint-disable @next/next/no-img-element -- Private authenticated previews cannot use an image proxy. */
import { readAdminResponse } from './read-response';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeShopMedia, mediaCapabilities, mediaPath, type ShopMedia } from './media-contract';
import { prepareShopImage } from './prepare-shop-image';
import { usePendingUpload } from './use-pending-upload';
import { useDialog } from './use-dialog';
import { UUID } from './shop-contract';
import styles from './ShopMediaAdmin.module.css';

export interface MediaSummary {
  total: number;
  published: number;
}

const messages: Record<string,string> = {
  invalid_upload:'This image could not be saved. Logos: static PNG or ordinary RGB JPEG, up to 8192 px per side and 24 MP. Photos: ordinary RGB JPEG or non-interlaced RGB/RGBA PNG; photo PNGs must be at most 2048 px per side without text or EXIF metadata.',
  invalid_request:'That request was refused. Nothing was changed. Reload images and try again.',
  authentication_required:'Sign in again to continue.', forbidden:'Your account cannot do this. Showing an image on the public page, taking it off again and deleting it all need an admin account.',
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

export function ShopMediaAdmin({shopId,shopName,published,archived,role,onSummary}: {
  shopId:string;shopName:string;published:boolean;archived:boolean;
  /** The signed-in account's catalogue role, or null while it is unknown. */
  role?:'editor'|'admin'|null;onSummary?:(summary:MediaSummary)=>void;
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

  // Two separate gates. `canChange` is about the ACTOR: showing, hiding and
  // deleting an image are admin-only on the server, so an editor is told that
  // rather than shown a button that returns 403. `canRemove` is about the
  // DEPLOYMENT: permanent deletion does not exist until the service says so.
  const canChange = role === 'admin';
  const canRemove = canChange && capabilities.includes('remove');
  const canArrange = canChange && capabilities.includes('arrange');
  const arrange = (order: ShopMedia[], captions: Record<string,string|null> = {}) => void run(async signal => {
    try {
      apply(await call(path,signal,post({action:'arrange',order:order.map(e => e.id),captions,
        revisions:Object.fromEntries(entries.map(e => [e.id,e.revision]))})));
      setNotice('Gallery saved. Changes to images already shown on the public page are live. Private images stay private.');
    } catch (e) {
      await call(path,signal).then(apply).catch(() => {});
      throw e;
    }
  });
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

    {canArrange && <p className={styles.help}>Cover, order and caption changes save separately. Changes to images already on the public page are visible immediately; private images stay private.</p>}
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
            {canArrange && kind === 'photo' && <>
              <p className={styles.help}>{index === 0 ? 'First photo · gallery cover when public' : `Gallery position ${index+1}`}</p>
              <CaptionEditor key={`${entry.id}:${entry.caption ?? ""}`} value={entry.caption ?? ''} disabled={busy || archived}
                save={caption => arrange(entries,{[entry.id]:caption || null})} />
              <div className={styles.cardActions}>
                <button type="button" disabled={busy || archived || index === 0} onClick={() => arrange([entry,...entries.filter(e => e.id !== entry.id)])}>Make cover</button>
                <button type="button" disabled={busy || archived || index === 0} onClick={() => {
                  const next = [...entries], at=next.indexOf(entry), previous=next.indexOf(photos[index-1]!);
                  [next[at],next[previous]]=[next[previous]!,next[at]!]; arrange(next);
                }}>Move earlier</button>
                <button type="button" disabled={busy || archived || index === photos.length-1} onClick={() => {
                  const next = [...entries], at=next.indexOf(entry), following=next.indexOf(photos[index+1]!);
                  [next[at],next[following]]=[next[following]!,next[at]!]; arrange(next);
                }}>Move later</button>
              </div>
            </>}
            <div className={styles.cardActions}>
              {canChange && <button type="button" disabled={busy || archived} onClick={() => setConfirmation({entry,action:entry.status === 'approved' ? 'hide' : 'publish'})}>
                {entry.status === 'approved' ? 'Remove from public page' : 'Show on public page'}
              </button>}
              {canRemove && <button type="button" className={styles.danger} disabled={busy || archived}
                onClick={() => setConfirmation({entry,action:'remove'})}>Delete image</button>}
            </div>
          </figure>)}
        </div>;
      })}
    </div>

    {loaded && !canChange && <p className={styles.help}>
      <strong>Your account can add images but cannot change what is public.</strong> Showing an image on the
      {' '}public page, taking it off again and deleting it need an admin account, so those controls are not
      {' '}shown here. Upload what you need and ask an admin to review it.
    </p>}

    {loaded && canChange && !canRemove && <p className={styles.help}>
      <strong>Deleting an image for good is not available yet.</strong> “Remove from the public page” takes an image
      {' '}off the live listing straight away and keeps it here in the draft, so nothing a visitor can see is left behind.
      {' '}A Delete button will appear here on its own once permanent deletion is switched on.
    </p>}

    <button type="button" className={styles.quiet} disabled={busy} onClick={() => void run(async signal => {
      apply(await call(path,signal)); setLoaded(true); setConfirmation(null); setNotice('Images reloaded.');
    })}>Reload images</button>

    {confirmation && <MediaDialog pending={confirmation} shopName={shopName} published={published} busy={busy} fallback={feedback}
      onCancel={() => setConfirmation(null)}
      onConfirm={() => {
        const pending = confirmation;
        setConfirmation(null);
        void run(async signal => {
          try {
            const r = await call(path,signal,post({action:pending.action,id:pending.entry.id,revision:pending.entry.revision}));
            apply(r);
            setNotice(pending.action === 'publish'
              ? (published ? 'Now on the public page. Open the public shop page to check it.' : 'Marked for the public page. It appears once the shop itself is published.')
              : pending.action === 'hide' ? 'Taken off the public page. It is still saved in this draft.'
              : 'Image deleted.');
          } catch (e) {
            // A refused change leaves the saved list stale, and its revision with
            // it, so reload before the editor can try the same thing again.
            await call(path,signal).then(apply).catch(() => {});
            throw e;
          }
        });
      }}/>}
  </section>;
}

function CaptionEditor({value,disabled,save}: {value:string;disabled:boolean;save:(caption:string)=>void}) {
  const [caption,setCaption] = useState(value);
  usePendingUpload(caption !== value);
  return <div className={styles.picker}>
    <label>Photo caption · optional
      <textarea value={caption} maxLength={300} disabled={disabled} onChange={e => setCaption(e.target.value)} />
    </label>
    <button type="button" disabled={disabled || caption === value} onClick={() => save(caption)}>Save caption</button>
  </div>;
}

function MediaDialog({pending,shopName,published,busy,fallback,onCancel,onConfirm}: {
  pending:Pending;shopName:string;published:boolean;busy:boolean;
  fallback:React.RefObject<HTMLElement|null>;onCancel:()=>void;onConfirm:()=>void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Deleting removes the button that opened this dialog, so focus falls back to
  // the section's own status region rather than to the top of the document.
  useDialog(box,onCancel,fallback);
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
         body:`${live ? 'It is currently on the public page: deleting removes it from the live listing and from this draft.' : 'It is private, so this affects this draft only.'} Deleting cannot be undone from this interface. The upload is retained for audit and still counts toward the 50-image limit.`,
         verb:'Delete image'};
  return <div className={styles.scrim} onMouseDown={onCancel}>
    <div ref={box} className={styles.dialog} role="alertdialog" aria-modal="true" aria-label={copy.title} onMouseDown={e => e.stopPropagation()}>
      <h3>{copy.title}</h3>
      <p>{copy.body}</p>
      <div className={styles.dialogActions}>
        <button autoFocus type="button" disabled={busy} className={pending.action === 'remove' ? styles.danger : undefined} onClick={onConfirm}>
          {copy.verb}
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
  const prepared = useRef<{file:File;image:Awaited<ReturnType<typeof prepareShopImage>>} | null>(null);
  const session = useRef<string | null>(null), input = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); },[preview]);
  usePendingUpload(!!file);
  const save = (file: File) => void run(async signal => {
        setFailed(false);
        try {
        if (prepared.current?.file !== file) {
          prepared.current = {file,image:await prepareShopImage(file,kind === 'logo')};
          if (kind === 'logo' && prepared.current.image.contentType === 'image/png' && !signal.aborted) {
            setPreview(URL.createObjectURL(new Blob([prepared.current.image.bytes], {type:'image/png'})));
          }
        }
        const {bytes,contentType} = prepared.current.image;
        const base = '/api/v1/admin/media/uploads';
        if (!session.current) {
          const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b => b.toString(16).padStart(2,'0')).join('');
          const r = await call(base,signal,post({shopId,purpose:kind === 'logo' ? 'shop_logo' : 'shop_photo',sha256,byteSize:bytes.byteLength,contentType}));
          if (typeof r.id !== 'string' || !UUID.test(r.id)) throw new MediaFailure('service_unavailable');
          session.current = r.id;
        }
        const url = `${base}/${session.current}`;
        // A retry first recovers a lost PUT/finalization response without reprocessing JPEG.
        try { await call(url,signal,{method:'POST'}); }
        catch (e) {
          if (!(e instanceof MediaFailure) || e.code !== 'upload_incomplete') throw e;
          await call(url,signal,{method:'PUT',headers:{'Content-Type':contentType},body:bytes});
          await call(url,signal,{method:'POST'});
        }
        const r = await call(mediaPath(shopId),signal,post({action:'attach',id:session.current}));
        saved(r);setFile(null);setPreview('');session.current = null;prepared.current = null;
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
      <input ref={input} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={disabled} onChange={e => {
      setPreview('');setError('');setFailed(false);session.current = null;prepared.current = null;
      const f = e.target.files?.[0] ?? null;
      if (f && (f.size < 1 || f.size > 5*1024*1024)) {
        setFile(null); setError('Choose a PNG or JPEG up to 5 MiB.'); return;
      }
      setFile(f);
      if (f) { if (kind === 'photo') setPreview(URL.createObjectURL(f)); save(f); }
    }}/></label>
    <p className={styles.help}>{kind === 'logo' ? 'JPEG or PNG, up to 5 MiB, 24 MP and 8192 px per side. Logos automatically fit within 1024 px, keeping their proportions and PNG transparency. No cropping or stretching.' : 'JPEG or PNG, up to 5 MiB. JPEG: up to 24 MP / 8192 px per side. PNG: up to 2048 px per side.'} Choosing a file saves it privately straight away.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {file && <div className={styles.pendingUpload}>
      {preview && <img className={kind === 'logo' ? styles.logo : styles.photo} src={preview} alt={`Selected ${label} for ${shopName}`}/>}
      <p>{file.name} · {failed ? 'not saved' : 'saving…'}</p>
      {failed && <button type="button" disabled={disabled} onClick={() => save(file)}>Retry saving this {label}</button>}
      {failed && <button type="button" className={styles.quiet} onClick={() => {
        setFile(null);setPreview('');setFailed(false);session.current = null;prepared.current = null;
        if (input.current) input.current.value = '';
      }}>Discard this file</button>}
    </div>}
  </div>;
}
