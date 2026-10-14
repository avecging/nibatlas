"use client";

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VerificationBindingV1, StampFailureCode, StampResponseV1 } from '@/src/api/v1/stamp-verification';
import type { StampCollection } from '@/src/domain/passport';
import type { ShopDetail } from '@/src/domain/shop-detail';
import { captureProductEvent, type FailureReason } from '@/src/features/analytics/posthog';
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
export function coarseFailure(code: Failure): FailureReason {
  if (code === 'permission_denied') return 'permission_denied';
  if (code === 'outside_radius') return 'too_far_away';
  if (code === 'position_timeout' || code === 'position_unavailable' || code === 'poor_accuracy') return 'location_unavailable';
  return 'unknown';
}
const MESSAGES: Record<Failure,string> = {
  authentication_required:'Please sign in again, then restart the location check.',
  permission_denied:'Location is blocked for this site. Allow location in your browser and device settings, then try again. If you opened this inside another app, open the page in Safari or Chrome.',
  untrusted_origin:'This request could not be accepted. Reopen the shop page and try again.',
  poor_accuracy:'Your location is not clear enough. Try near an entrance or window, then take a fresh reading.',
  stale_position:'The location check was interrupted or took too long. Keep this page visible and start again.',
  outside_radius:'We could not confirm that you are at this shop. Check that you have the right shop, then try again at its entrance.',
  invalid_nonce:'The location check is no longer valid. Start a new check.',
  expired_nonce:'The location check expired. Start a new check before confirming.',
  reused_nonce:'That location check has already been used. Start a new check.',
  throttled:'Please pause your attempts and try again later.',
  shop_unavailable:'Stamp collection is currently unavailable at this shop.',
  service_unavailable:'The location check is unavailable right now. Please try again.',
  invalid_request:'The request could not be accepted. Reopen the shop page and try again.',
  position_timeout:'Your phone could not find a location in time. Try near an entrance or window, keep this page open, then try again.',
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
  const [checkPhase,setCheckPhase] = useState<'locating'|'verifying'>('locating');
  const [failure,setFailure] = useState<Failure>('service_unavailable');
  const [poorRetries,setPoorRetries] = useState(0);
  // A nonce or verification failure cannot issue an impression. Once a collect
  // request was sent, keep recovery available across retries/cancel until its
  // result is known; a later failed check cannot disprove that earlier issuance.
  const [issuanceUncertain,setIssuanceUncertain] = useState(false);
  const uncertainRequests = useRef(new Set<AbortController>());
  const [ceremony,setCeremony] = useState<{collection:StampCollection;duplicate:boolean}|null>(null);
  const binding = useRef<VerificationBindingV1|null>(null);
  const pending = useRef<AbortController|null>(null);
  const owner = session.status === 'signed-in' ? session.userId : null;
  const existing = store.collectionForShop(shop.id);
  const discardPending = useCallback(() => {
    // Location/confirmation work is cancellable. Already-authorized issuance
    // must settle into its original account even after navigation or hiding.
    if (pending.current && !uncertainRequests.current.has(pending.current)) pending.current.abort();
    pending.current=null; binding.current=null;
  },[]);
  const close = useCallback(() => {
    discardPending();
    setOpen(false); setStage('preflight'); setPoorRetries(0);
    const url = new URL(window.location.href); url.searchParams.delete('collect');
    window.history.replaceState(window.history.state,'',`${url.pathname}${url.search}${url.hash}`);
  },[discardPending]);
  const cancel = useCallback(() => {
    if (issuanceUncertain) store.retryRead?.();
    close();
  },[close,issuanceUncertain,store]);
  const dialogRef = useDialogFocus<HTMLDivElement>(open && owner !== null,cancel);
  useEffect(() => {
    const invalidate = () => {
      if (!pending.current && !binding.current) return;
      // An issuance already sent still has an outcome to settle; only the
      // interrupted location/confirmation work is a failed check at this point.
      if (!pending.current || !uncertainRequests.current.has(pending.current)) {
        captureProductEvent('check_in_failed', 'unknown');
      }
      discardPending();
      setFailure('stale_position'); setStage('error');
    };
    const hidden = () => { if (document.visibilityState !== 'visible') invalidate(); };
    document.addEventListener('visibilitychange',hidden);
    window.addEventListener('pagehide',invalidate);
    return () => {
      discardPending();
      document.removeEventListener('visibilitychange',hidden);
      window.removeEventListener('pagehide',invalidate);
    };
  },[discardPending,owner,shop.id]);
  const settleRefusal = (controller:AbortController) => {
    uncertainRequests.current.delete(controller);
    setIssuanceUncertain(uncertainRequests.current.size > 0);
  };
  const settleIssued = () => {
    // One original impression settles every attempt for this shop/account.
    uncertainRequests.current.clear();
    setIssuanceUncertain(false);
  };
  const fail = (code:Failure, mayHaveIssued = uncertainRequests.current.size > 0) => {
    captureProductEvent('check_in_failed', coarseFailure(code));
    binding.current=null; pending.current=null; setFailure(code); setStage('error');
    if (mayHaveIssued && (code === 'reused_nonce' || code === 'service_unavailable')) store.retryRead?.();
  };
  const receiveCollection = (response:StampResponseV1) => {
    if (!response.ok || (response.status !== 'success' && response.status !== 'duplicate')) return false;
    const collection = decodeCollection(response.collection,shop.slug);
    if (collection.shopId !== shop.id) { fail('service_unavailable'); return true; }
    captureProductEvent('check_in_succeeded');
    store.acceptIssued?.(collection);
    settleIssued();
    close(); setCeremony({collection,duplicate:response.status === 'duplicate'});
    return true;
  };
  async function checkLocation() {
    if (pending.current || !owner) return;
    binding.current=null;
    const controller = new AbortController(); pending.current=controller;
    captureProductEvent('check_in_started');
    setStage('checking'); setCheckPhase('locating');
    const valid = () => !controller.signal.aborted && pending.current === controller && document.visibilityState === 'visible';
    // Start in the button's call stack, before any server await, so mobile
    // browsers receive a foreground, user-initiated permission request.
    const fixPromise = foregroundPosition(controller.signal).then(fix => {
      if (valid() && fix.ok) setCheckPhase('verifying');
      else if (valid() && !fix.ok && fix.code !== 'permission_denied') { fail(fix.code); controller.abort(); }
      return { fix, receivedAt: performance.now() };
    });
    // Bound the whole nonce + verification wait as well as the phone's 12s fix.
    // Issuance is separate: this timeout never aborts an authorized collect.
    const deadline = setTimeout(() => {
      if (valid()) { fail('service_unavailable'); controller.abort(); }
    }, 20000);
    try {
      const nonce = await stampRequest('nonce',{shopId:shop.id},controller.signal);
      if (!valid()) { if (!controller.signal.aborted) fail('stale_position'); return; }
      if (!nonce.ok) { controller.abort(); fail(nonce.error.code); return; }
      if (receiveCollection(nonce)) return;
      if (nonce.status !== 'nonce_issued') { controller.abort(); fail('service_unavailable'); return; }
      const proof = {shopId:shop.id,requestId:nonce.requestId,nonce:nonce.nonce};
      const {fix,receivedAt} = await fixPromise;
      if (!valid()) return;
      if (!fix.ok && fix.code !== 'permission_denied') { fail(fix.code); return; }
      // A quick fix must not wait indefinitely for a slow nonce response.
      if (fix.ok && performance.now() - receivedAt > 12000) { fail('stale_position'); return; }
      setCheckPhase('verifying');
      const response = await stampRequest('verify',fix.ok ? {...proof,position:fix.position}
        : {...proof,permission:'denied'},controller.signal);
      if (!valid()) return;
      if (!response.ok) { fail(response.error.code); return; }
      if (receiveCollection(response)) return;
      if (response.status !== 'confirmation_required') { fail('service_unavailable'); return; }
      binding.current=proof; pending.current=null; setStage('confirm');
    } finally { clearTimeout(deadline); }
  }
  async function confirm() {
    if (pending.current || !binding.current || !owner) return;
    if (document.visibilityState !== 'visible') { fail('stale_position'); return; }
    const proof=binding.current; binding.current=null;
    const controller=new AbortController(); pending.current=controller; setStage('issuing');
    uncertainRequests.current.add(controller);
    setIssuanceUncertain(true);
    const response=await stampRequest('collect',{...proof,confirmedAtShop:true},controller.signal);
    if (controller.signal.aborted) return;
    if (pending.current !== controller) {
      // Cancelled dialogs never reopen or replay a ceremony. The account store
      // survives navigation and rejects acceptance after its owner is unmounted.
      if (response.ok && (response.status === 'success' || response.status === 'duplicate')) {
        const collection=decodeCollection(response.collection,shop.slug);
        if (collection.shopId === shop.id) { captureProductEvent('check_in_succeeded'); store.acceptIssued?.(collection); settleIssued(); }
        else store.retryRead?.();
      } else {
        if (!response.ok && !['service_unavailable','reused_nonce'].includes(response.error.code)) settleRefusal(controller);
        store.retryRead?.();
      }
      return;
    }
    if (!response.ok) {
      // An explicit refusal settles this attempt, but cannot settle an older
      // interrupted one. Network/invalid-response failures remain uncertain.
      if (!['service_unavailable','reused_nonce'].includes(response.error.code)) settleRefusal(controller);
      fail(response.error.code); return;
    }
    if (!receiveCollection(response)) fail('service_unavailable',true);
  }
  function signIn() {
    const url=new URL(currentReturnTo(),window.location.origin); url.searchParams.set('collect','1');
    const returnTo=`${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state,'',returnTo);
    requestSignIn({context:`Collect a stamp at ${shop.name}`,intent:{type:'collect-shop',shopSlug:shop.slug},returnTo});
  }
  const retryable = !['throttled','shop_unavailable','invalid_request','untrusted_origin','authentication_required'].includes(failure)
    && !(failure === 'poor_accuracy' && poorRetries >= 1);
  const ceremonySeals=store.geographicSeals?.flatMap(r=>r.award?.unseen && ceremony && !ceremony.duplicate && r.award.derivedFromShopId===ceremony.collection.shopId?[r.award]:[]).sort((a,b)=>a.scope===b.scope?0:a.scope==='locality'?-1:1)??[];
  const acknowledgeCeremonySeals=()=>{if(ceremonySeals.length)store.acknowledgeSeals?.(ceremonySeals.map(s=>s.awardId));};
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
        {stage === 'checking' || stage === 'issuing' ? <p role="status">{stage === 'checking' ? checkPhase === 'locating' ? 'Finding your location… Allow location if your browser asks. This can take up to 12 seconds; keep this page visible.' : 'Checking your visit… Keep this page visible.':'Keeping your impression…'}</p> : null}
        {stage === 'confirm' ? <p>Your location check passed. Confirm that you are at {shop.name} to collect its stamp.</p> : null}
        {stage === 'error' ? <><p role="alert">{issuanceUncertain && ['service_unavailable','reused_nonce','stale_position'].includes(failure)
          ? 'We could not confirm the result of your collection request. Check your Passport before trying again; an issued stamp will not be issued twice.'
          : MESSAGES[failure]}</p>{issuanceUncertain && !['outside_radius','service_unavailable','reused_nonce','stale_position'].includes(failure) ? <p>An earlier collection request may have completed. Check your Passport before trying again.</p>:null}{failure === 'poor_accuracy' && poorRetries >= 1 ? <p>A second reading was still unclear. Please contact support for help.</p>:null}{failure !== 'outside_radius' ? <p><Link className={styles.dialogLink} href="/help#collection-help">Get help with collection</Link></p>:null}</>:null}
      </div>
      <div className={styles.dialogActions}>
        {stage === 'preflight' ? <Button fullWidth onClick={() => void checkLocation()}>Check my location</Button>:null}
        {stage === 'confirm' ? <Button fullWidth onClick={() => void confirm()}>I am at this shop</Button>:null}
        {stage === 'error' && retryable ? <Button fullWidth onClick={() => {
          if (failure === 'poor_accuracy') setPoorRetries(value => value+1);
          void checkLocation();
        }}>Try again</Button>:null}
        {stage === 'error' && failure === 'authentication_required' ? <Button fullWidth onClick={() => {cancel();signIn();}}>Sign in again</Button>:null}
        {stage === 'error' && issuanceUncertain && failure !== 'outside_radius' ? <ButtonLink href="/passport" fullWidth onClick={() => store.retryRead?.()}>Check Passport</ButtonLink>:null}
        <Button variant="quiet" fullWidth onClick={cancel}>Cancel</Button>
      </div>
    </div></div>:null}
    {ceremony ? <StampCeremony seals={ceremonySeals} onOpenPassport={acknowledgeCeremonySeals} collection={ceremony.collection} alreadyCollected={ceremony.duplicate}
      passportHref={`/passport/${ceremony.collection.countryCode.toLowerCase()}/${ceremony.collection.localitySlug}?stamp=${ceremony.collection.id}`}
      onClose={() => {acknowledgeCeremonySeals();setCeremony(null);}}/>:null}
  </>;
}
