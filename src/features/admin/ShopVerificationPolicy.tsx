"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { decodeVerificationPolicy, type VerificationPolicy } from './verification-policy';
import { readAdminResponse } from './read-response';
import styles from './ShopAdmin.module.css';

export function ShopVerificationPolicy({ shop, disabled }: { shop: string; disabled: boolean }) {
  const [policy, setPolicy] = useState<VerificationPolicy | null>(null);
  const [radius, setRadius] = useState('45'), [custom, setCustom] = useState(false), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(true), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const id = useId();
  function accept(value: VerificationPolicy) {
    setPolicy(value); setRadius(String(value.radiusMeters)); setCustom(value.custom); setReason(value.reason ?? '');
  }
  useEffect(() => {
    const controller = new AbortController(); pending.current = controller;
    async function load() {
      setBusy(true); setError(''); setMessage(''); setPolicy(null);
      try {
        const response = await fetch(`/api/v1/admin/shops/${shop}/verification-policy`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        const value = await readAdminResponse(response);
        if (controller.signal.aborted) return;
        if (!response.ok) throw Error();
        accept(decodeVerificationPolicy(value));
      } catch { if (!controller.signal.aborted) setError('Could not load the check-in radius. Reload to try again.'); }
      finally { if (!controller.signal.aborted) { pending.current = null; setBusy(false); } }
    }
    void load();
    return () => { controller.abort(); pending.current?.abort(); pending.current = null; };
  }, [shop, reload]);
  async function save() {
    if (busy || disabled || !policy) return;
    if (reason.trim().length < 10 || reason.length > 500) { setError('Explain the change in 10–500 characters.'); return; }
    if (custom && (!/^\d+$/.test(radius) || Number(radius) < 25 || Number(radius) > 300)) { setError('Choose a whole-number radius from 25 to 300 metres.'); return; }
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/v1/admin/shops/${shop}/verification-policy`, { method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: policy.revision, radiusMeters: custom ? Number(radius) : null, reason }) });
      const value = await readAdminResponse(response, true);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setError(value.error?.code === 'revision_conflict' ? 'The radius changed in another session. Reload before saving again.' : 'Could not confirm the save. Reload the saved radius before trying again.');
        setPolicy(null); return;
      }
      accept(decodeVerificationPolicy(value)); setMessage('Check-in radius saved. This applies immediately.');
    } catch { if (!controller.signal.aborted) { setError('Could not confirm the save. Reload the saved radius before trying again.'); setPolicy(null); } }
    finally { if (!controller.signal.aborted) { setBusy(false); pending.current = null; } }
  }
  return <div className={styles.box} aria-busy={busy}>
    <h3>Check-in radius</h3>
    <p className={styles.help}>Default: 45 metres from the saved shop pin. Check the shop entrance and confirm its map position before changing this. Poor location accuracy never widens the radius.</p>
    {busy && <p role="status">Loading or saving the check-in radius…</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <fieldset disabled={busy || disabled || !policy} className={styles.plain}>
      <legend>Shop location exception</legend>
      <label htmlFor={`${id}-mode`}>Radius setting</label>
      <select id={`${id}-mode`} value={custom ? 'custom' : 'default'} onChange={e => { setCustom(e.target.value === 'custom'); setReason(''); setMessage(''); }}>
        <option value="default">Use the default 45 metres</option><option value="custom">Use a custom radius</option>
      </select>
      {custom && <><label htmlFor={`${id}-radius`}>Radius in metres</label><input id={`${id}-radius`} inputMode="numeric" type="number" min="25" max="300" step="1" value={radius} onChange={e => setRadius(e.target.value)} /></>}
      <label htmlFor={`${id}-reason`}>Reason for this change</label><textarea id={`${id}-reason`} minLength={10} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
      <small>Explain the location issue or why the default should be restored (10–500 characters).</small>
      <button type="button" onClick={() => void save()}>Save check-in radius</button>
    </fieldset>
    {disabled && <small>Save your shop edits first. Archived shops cannot change their radius.</small>}
    <button type="button" disabled={busy} onClick={() => setReload(n => n + 1)}>Reload saved radius</button>
  </div>;
}
