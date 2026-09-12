"use client";

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VerificationBindingV1, StampFailureCode, StampResponseV1 } from '@/src/api/v1/stamp-verification';
import type { StampCollection } from '@/src/domain/passport';
import type { ShopDetail } from '@/src/domain/shop-detail';
import { useAccountSession } from '@/src/features/account/AccountSessionProvider';
import { useSignInPrompt } from '@/src/features/auth/SignInProvider';
import { currentReturnTo } from '@/src/features/auth/return-to';
import { useCollection } from '@/src/features/collection/collection-store';
import { decodeCollection, stampRequest } from '@/src/features/collection/collection-client';
import { foregroundPosition, type PositionFailure } from '@/src/features/collection/foreground-position';
import { useDialogFocus } from '@/src/components/hooks/useDialogFocus';
import { Button, ButtonLink } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { StampCeremony } from './StampCeremony';
import styles from '@/src/components/shops/ShopActions.module.css';

type Failure = StampFailureCode | PositionFailure;
const MESSAGES: Record<Failure,string> = {
  authentication_required:'Please sign in again, then restart the location check.',
  permission_denied:'Location permission was denied. Enable location for this site in your browser settings, then try again.',
  untrusted_origin:'This request could not be accepted. Reopen the shop page and try again.',
  poor_accuracy:'Your location is not clear enough. Try near an entrance or window, then take a fresh reading.',
  stale_position:'The location check was interrupted or took too long. Keep this page visible and start again.',
  outside_radius:'We could not confirm that you are at this shop. Check that you have the right shop, then try again at its entrance.',
  invalid_nonce:'The location check is no longer valid. Start a new check.',
  expired_nonce:'The location check expired. Start a new check before confirming.',
  reused_nonce:'That check has already been used. Check your Passport or start again to recover the original impression.',
  throttled:'Please pause your attempts and try again later.',
  shop_unavailable:'Stamp collection is currently unavailable at this shop.',
  service_unavailable:'We could not confirm the result. Check your Passport or try again; an issued stamp will not be issued twice.',
  invalid_request:'The request could not be accepted. Reopen the shop page and try again.',
  position_unavailable:'Your browser could not find your location. Check your device location settings and try again.',
};

/** API-mode entry only. Reviewer simulation remains a separate component path. */
export function VerifiedCollection({ shop }: { readonly shop:ShopDetail }) {
  const store = useCollection();
  const { session } = useAccountSession();
  const { requestSignIn } = useSignInPrompt();
  const [open, setOpen] = useState(() => typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('collect') === '1');
  const [stage,setStage] = useState<'preflight'|'checking'|'confirm'|'issuing'|'error'>('preflight');
  const [failure,setFailure] = useState<Failure>('service_unavailable');
  const [poorRetries,setPoorRetries] = useState(0);
  const [ceremony,setCeremony] = useState<{collection:StampCollection;duplicate:boolean}|null>(null);
  const binding = useRef<VerificationBindingV1|null>(null);
  const pending = useRef<AbortController|null>(null);
  const owner = session.status === 'signed-in' ? session.userId : null;
  const existing = store.collectionForShop(shop.id);
  const close = useCallback(() => {
    pending.current?.abort(); pending.current=null; binding.current=null;
    setOpen(false); setStage('preflight'); setPoorRetries(0);
    const url = new URL(window.location.href); url.searchParams.delete('collect');
    window.history.replaceState(window.history.state,'',`${url.pathname}${url.search}${url.hash}`);
  },[]);
  const dialogRef = useDialogFocus<HTMLDivElement>(open && owner !== null,close);
  useEffect(() => {
    const invalidate = () => {
      if (!pending.current && !binding.current) return;
      pending.current?.abort(); pending.current=null; binding.current=null;
      setFailure('stale_position'); setStage('error');
    };
    const hidden = () => { if (document.visibilityState !== 'visible') invalidate(); };
    document.addEventListener('visibilitychange',hidden);
    window.addEventListener('pagehide',invalidate);
    return () => {
      pending.current?.abort(); pending.current=null; binding.current=null;
      document.removeEventListener('visibilitychange',hidden);
      window.removeEventListener('pagehide',invalidate);
    };
  },[owner,shop.id]);
  const fail = (code:Failure) => {
    binding.current=null; pending.current=null; setFailure(code); setStage('error');
    if (code === 'reused_nonce' || code === 'service_unavailable') store.retryRead?.();
  };
  const receiveCollection = (response:StampResponseV1) => {
    if (!response.ok || (response.status !== 'success' && response.status !== 'duplicate')) return false;
    const collection = decodeCollection(response.collection,shop.slug);
    if (collection.shopId !== shop.id) { fail('service_unavailable'); return true; }
    store.acceptIssued?.(collection);
    close(); setCeremony({collection,duplicate:response.status === 'duplicate'});
    return true;
  };
  async function checkLocation() {
    if (pending.current || !owner) return;
    binding.current=null;
    const controller = new AbortController(); pending.current=controller;
    setStage('checking');
    const valid = () => !controller.signal.aborted && pending.current === controller && document.visibilityState === 'visible';
    const nonce = await stampRequest('nonce',{shopId:shop.id},controller.signal);
    if (!valid()) { if (!controller.signal.aborted) fail('stale_position'); return; }
    if (!nonce.ok) { fail(nonce.error.code); return; }
    if (receiveCollection(nonce)) return;
    if (nonce.status !== 'nonce_issued') { fail('service_unavailable'); return; }
    const proof = {shopId:shop.id,requestId:nonce.requestId,nonce:nonce.nonce};
    const fix = await foregroundPosition(controller.signal);
    if (!valid()) return;
    if (!fix.ok && fix.code !== 'permission_denied') { fail(fix.code); return; }
    const response = await stampRequest('verify',fix.ok ? {...proof,position:fix.position}
      : {...proof,permission:'denied'},controller.signal);
    if (!valid()) return;
    if (!response.ok) { fail(response.error.code); return; }
    if (receiveCollection(response)) return;
    if (response.status !== 'confirmation_required') { fail('service_unavailable'); return; }
    binding.current=proof; pending.current=null; setStage('confirm');
  }
  async function confirm() {
    if (pending.current || !binding.current || !owner) return;
    if (document.visibilityState !== 'visible') { fail('stale_position'); return; }
    const proof=binding.current; binding.current=null;
    const controller=new AbortController(); pending.current=controller; setStage('issuing');
    const response=await stampRequest('collect',{...proof,confirmedAtShop:true},controller.signal);
    if (controller.signal.aborted || pending.current !== controller) return;
    if (!response.ok) { fail(response.error.code); return; }
    if (!receiveCollection(response)) fail('service_unavailable');
  }
  function signIn() {
    const url=new URL(currentReturnTo(),window.location.origin); url.searchParams.set('collect','1');
    const returnTo=`${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state,'',returnTo);
    requestSignIn({context:`Collect a stamp at ${shop.name}`,intent:{type:'collect-shop',shopSlug:shop.slug},returnTo});
  }
  const retryable = !['throttled','shop_unavailable','invalid_request','untrusted_origin','authentication_required'].includes(failure)
    && !(failure === 'poor_accuracy' && poorRetries >= 1);
  return <>
    <Button variant={existing ? 'collected':'stamp'} disabled={session.status === 'loading'} onClick={() => {
      if (!owner) { signIn(); return; }
      if (existing) setCeremony({collection:existing,duplicate:true});
      else { setStage('preflight'); setOpen(true); }
    }}><Icon name="seal" size={18}/>{existing ? 'View Atlas Stamp':'Collect Stamp'}</Button>
    {open && owner ? <div className={styles.backdrop}><div ref={dialogRef} className={styles.dialog}
      role="dialog" aria-modal="true" aria-labelledby="verified-collect-title" tabIndex={-1}>
      <h2 className={styles.dialogTitle} id="verified-collect-title">{stage === 'confirm' ? 'Confirm your visit':'Before you collect'}</h2>
      <div className={styles.dialogBody}>
        {stage === 'preflight' ? <p>Use your location once to check that you are at this shop. Your precise position is checked and discarded, never stored. <Link href="/privacy" className={styles.dialogLink}>How location is used</Link>.</p> : null}
        {stage === 'checking' || stage === 'issuing' ? <p role="status">{stage === 'checking' ? 'Checking your location… Keep this page visible.':'Keeping your impression…'}</p> : null}
        {stage === 'confirm' ? <p>Your location check passed. Confirm that you are at {shop.name} to collect its stamp.</p> : null}
        {stage === 'error' ? <><p role="alert">{MESSAGES[failure]}</p>{failure === 'poor_accuracy' && poorRetries >= 1 ? <p>A second reading was still unclear. Please contact support for help.</p>:null}{failure !== 'outside_radius' ? <p><Link className={styles.dialogLink} href="/help#collection-help">Get help with collection</Link></p>:null}</>:null}
      </div>
      <div className={styles.dialogActions}>
        {stage === 'preflight' ? <Button fullWidth onClick={() => void checkLocation()}>Check my location</Button>:null}
        {stage === 'confirm' ? <Button fullWidth onClick={() => void confirm()}>I am at this shop</Button>:null}
        {stage === 'error' && retryable ? <Button fullWidth onClick={() => {
          if (failure === 'poor_accuracy') setPoorRetries(value => value+1);
          void checkLocation();
        }}>Try again</Button>:null}
        {stage === 'error' && failure === 'authentication_required' ? <Button fullWidth onClick={() => {close();signIn();}}>Sign in again</Button>:null}
        {stage === 'error' && failure !== 'outside_radius' ? <ButtonLink href="/passport" fullWidth>Check Passport</ButtonLink>:null}
        <Button variant="quiet" fullWidth onClick={close}>Cancel</Button>
      </div>
    </div></div>:null}
    {ceremony ? <StampCeremony collection={ceremony.collection} alreadyCollected={ceremony.duplicate}
      passportHref={`/passport/${ceremony.collection.countryCode.toLowerCase()}/${ceremony.collection.localitySlug}?stamp=${ceremony.collection.id}`}
      onClose={() => setCeremony(null)}/>:null}
  </>;
}
