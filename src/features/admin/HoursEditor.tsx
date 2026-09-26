"use client";
import { useId, useState } from 'react';
import { HOURS_FIELDS, type Row, type Value } from './shop-contract';
import type { FieldIssue } from './shop-normalization';
import styles from './ShopAdmin.module.css';

const days = HOURS_FIELDS[0]!.choices!;
const label = (day: string) => day[0]!.toUpperCase() + day.slice(1);

/** Edits the existing weekly contract only. No synthesized times or confirmations. */
export function HoursEditor({value, errors, onChange}: {
  value: Value | undefined; errors: FieldIssue[]; onChange: (value: Value) => void;
}) {
  const hours = (value as Row | null) ?? {};
  const entries = (hours.entries ?? []) as Row[];
  const exceptions = (hours.exceptions ?? []) as Row[];
  const [copyFrom, setCopyFrom] = useState('monday');
  const [copyTo, setCopyTo] = useState('tuesday');
  const [notice, setNotice] = useState('');
  const id = useId();
  const change = (next: Row[]) => onChange({...hours, entries: next});
  const changeException = (index: number, patch: Row) => onChange({...hours, exceptions: exceptions.map((r, i) => i === index ? {...r, ...patch} : r)});
  const fieldError = (path: string) => errors.find(e => e.path === path)?.message;
  const input = (row: Row, index: number, key: 'opens' | 'closes' | 'note') => {
    const path = `shop.opening_hours.entries.${index}.${key}`;
    const error = fieldError(path), control = `${id}-${index}-${key}`;
    return <div className={styles.field} key={key}>
      <label htmlFor={control}>{key === 'note' ? 'Hours note' : key === 'opens' ? 'Opens' : 'Closes'}</label>
      <input id={control} data-field-path={path} value={String(row[key] ?? '')}
        placeholder={key === 'note' ? undefined : 'HH:MM'} maxLength={key === 'note' ? 4000 : 5}
        aria-invalid={!!error || undefined} aria-describedby={error ? `${control}-error` : undefined}
        onChange={e => change(entries.map((r, i) => i === index ? {...r, [key]: e.target.value || null} : r))}/>
      {error && <small id={`${control}-error`} className={styles.inlineError}>{error}</small>}
    </div>;
  };
  return <div className={styles.box} data-field-path="shop.opening_hours" tabIndex={-1}>
    <h3>Opening hours</h3>
    <p className={styles.help}>Unknown is different from closed. Add one entry per opening period; use two for a split day. Times use 24-hour HH:MM. An earlier closing time means the following day. No opening hours are required to save or publish.</p>
    <p className={styles.help}>No entry (unknown): {days.filter(day => !entries.some(r => r.day === day)).map(label).join(', ') || 'None'}.</p>
    <label htmlFor={`${id}-summary`}>Hours summary · optional</label>
    <textarea id={`${id}-summary`} data-field-path="shop.opening_hours.note" maxLength={4000}
      value={String(hours.note ?? '')} aria-invalid={!!fieldError('shop.opening_hours.note') || undefined}
      aria-describedby={fieldError('shop.opening_hours.note') ? `${id}-summary-error` : undefined}
      onChange={e => onChange({...hours, note: e.target.value || null})}/>
    {fieldError('shop.opening_hours.note') && <small id={`${id}-summary-error`} className={styles.inlineError}>{fieldError('shop.opening_hours.note')}</small>}
    {entries.map((row, index) => {
      const path = `shop.opening_hours.entries.${index}`;
      const state = row.closed === true ? 'closed' : row.closed === false || row.opens || row.closes ? 'open' : 'unknown';
      return <fieldset key={index} className={styles.card}>
        <legend>Hours {index + 1}</legend>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor={`${id}-${index}-day`}>Day</label>
            <select id={`${id}-${index}-day`} data-field-path={`${path}.day`} value={String(row.day ?? '')}
              aria-invalid={!!fieldError(`${path}.day`) || undefined} aria-describedby={fieldError(`${path}.day`) ? `${id}-${index}-day-error` : undefined}
              onChange={e => change(entries.map((r,i) => i === index ? {...r, day:e.target.value} : r))}>
              <option value="">Choose a day</option>{days.map(day => <option key={day} value={day}>{label(day)}</option>)}
            </select>
            {fieldError(`${path}.day`) && <small id={`${id}-${index}-day-error`} className={styles.inlineError}>{fieldError(`${path}.day`)}</small>}
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-${index}-state`}>Hours state</label>
            <select id={`${id}-${index}-state`} data-field-path={`${path}.closed`} value={state}
              aria-invalid={!!fieldError(`${path}.closed`) || undefined}
              aria-describedby={fieldError(`${path}.closed`) ? `${id}-${index}-state-error` : undefined}
              onChange={e => {
                const next = e.target.value;
                if (next !== 'open' && (row.opens || row.closes) && !window.confirm('Clear the opening and closing times for this entry? Its note will be kept.')) return;
                change(entries.map((r,i) => i === index ? {...r, closed:next === 'unknown' ? null : next === 'closed', ...(next !== 'open' ? {opens:null, closes:null} : {})} : r));
              }}>
              <option value="unknown">Unknown</option><option value="open">Open · times optional</option><option value="closed">Closed</option>
            </select>
            {fieldError(`${path}.closed`) && <small id={`${id}-${index}-state-error`} className={styles.inlineError}>{fieldError(`${path}.closed`)}</small>}
          </div>
          {state !== 'closed' && <>{input(row,index,'opens')}{input(row,index,'closes')}</>}
          {input(row,index,'note')}
        </div>
        {row.opens && row.closes && String(row.closes) < String(row.opens) ? <p className={styles.help}>Closes the following day.</p> : null}
        <button type="button" className={styles.quiet} onClick={e => {
          change(entries.filter((_,i) => i !== index));
          e.currentTarget.closest('[data-field-path="shop.opening_hours"]')?.querySelector<HTMLElement>('[data-add-hours]')?.focus();
        }}>Remove hours {index + 1}</button>
      </fieldset>;
    })}
    <button type="button" data-add-hours disabled={entries.length >= 100} onClick={() => change([...entries,{day:'monday',opens:null,closes:null,closed:null,note:null}])}>Add hours</button>
    <fieldset className={styles.group}>
      <legend>Copy a day</legend>
      <p className={styles.help}>Copies every period and its note. Review before saving; existing entries on the destination day will be replaced.</p>
      <div className={styles.grid}>
        <label>Copy from<select value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>{days.map(day => <option key={day} value={day}>{label(day)}</option>)}</select></label>
        <label>Copy to<select value={copyTo} onChange={e => setCopyTo(e.target.value)}>{days.map(day => <option key={day} value={day}>{label(day)}</option>)}</select></label>
      </div>
      <button type="button" disabled={copyFrom === copyTo || !entries.some(r => r.day === copyFrom)} onClick={() => {
        const next = [...entries.filter(r => r.day !== copyTo), ...entries.filter(r => r.day === copyFrom).map(r => ({...r,day:copyTo}))]
          .sort((a,b) => days.indexOf(String(a.day)) - days.indexOf(String(b.day)));
        if (next.length > 100) { setNotice('This would exceed 100 opening periods. Remove unused entries first.'); return; }
        if (entries.some(r => r.day === copyTo) && !window.confirm(`Replace all ${label(copyTo)} entries with ${label(copyFrom)} hours and notes?`)) return;
        change(next); setNotice(`Copied ${label(copyFrom)} to ${label(copyTo)}. Save to keep these edits.`);
      }}>Copy hours</button>
    </fieldset>
    <h4>Date-specific exceptions</h4>
    <p className={styles.help}>These dates override the weekly hours on that date. Add separate periods for a split day. An earlier closing time means the next day. Dates and times are local to the shop.</p>
    {exceptions.map((row, index) => {
      const path = `shop.opening_hours.exceptions.${index}`;
      const state = row.closed === true ? 'closed' : row.closed === false || row.opens || row.closes ? 'open' : 'unknown';
      const control = (key: 'date' | 'opens' | 'closes' | 'note', type = 'text') => {
        const field = `${id}-exception-${index}-${key}`, error = fieldError(`${path}.${key}`);
        return <div className={styles.field} key={key}><label htmlFor={field}>{key === 'note' ? 'Exception note' : key[0]!.toUpperCase() + key.slice(1)}</label>
          <input id={field} type={type} data-field-path={`${path}.${key}`} value={String(row[key] ?? '')}
            maxLength={key === 'note' ? 4000 : key === 'date' ? 10 : 5}
            aria-invalid={!!error || undefined} aria-describedby={error ? `${field}-error` : undefined}
            onChange={e => changeException(index, {[key]: e.target.value || null})}/>
          {error && <small id={`${field}-error`} className={styles.inlineError}>{error}</small>}</div>;
      };
      return <fieldset key={index} className={styles.card}><legend>Exception {index + 1}</legend><div className={styles.grid}>
        {control('date', 'date')}
        <div className={styles.field}><label htmlFor={`${id}-exception-${index}-state`}>Exception state</label>
          <select id={`${id}-exception-${index}-state`} data-field-path={`${path}.closed`} value={state}
            aria-invalid={!!fieldError(`${path}.closed`) || undefined}
            aria-describedby={fieldError(`${path}.closed`) ? `${id}-exception-${index}-state-error` : undefined}
            onChange={e => {
              const next = e.target.value;
              if (next !== 'open' && (row.opens || row.closes) && !window.confirm('Clear the times for this exception? Its note will be kept.')) return;
              changeException(index, {closed: next === 'unknown' ? null : next === 'closed', ...(next !== 'open' ? {opens:null, closes:null} : {})});
            }}><option value="unknown">Unknown</option><option value="open">Open · times optional</option><option value="closed">Closed</option></select>
          {fieldError(`${path}.closed`) && <small id={`${id}-exception-${index}-state-error`} className={styles.inlineError}>{fieldError(`${path}.closed`)}</small>}
        </div>
        {state !== 'closed' && <>{control('opens')}{control('closes')}</>}
        {control('note')}
      </div>
      {row.opens && row.closes && String(row.closes) < String(row.opens) && <p className={styles.help}>Closes the following day.</p>}
      <button type="button" className={styles.quiet} onClick={e => {
        onChange({...hours, exceptions: exceptions.filter((_, i) => i !== index)});
        e.currentTarget.closest('[data-field-path="shop.opening_hours"]')?.querySelector<HTMLElement>('[data-add-exception]')?.focus();
      }}>Remove exception {index + 1}</button></fieldset>;
    })}
    <button type="button" data-add-exception disabled={exceptions.length >= 100} onClick={() => onChange({...hours, exceptions: [...exceptions, {date:null,opens:null,closes:null,closed:null,note:null}]})}>Add date exception</button>
    <button type="button" className={styles.quiet} disabled={value == null} onClick={() => {
      if (window.confirm('Clear weekly hours, date exceptions and the hours summary? The separate holiday note will be kept. Save to apply this change.')) { onChange(null); setNotice('Hours cleared in this editor. Save to keep the change.'); }
    }}>Clear all hours</button>
    <p role="status">{notice}</p>
    <p className={styles.help}>Use the holiday note above for general holiday guidance. Save and publish shop text to make date exceptions public.</p>
  </div>;
}
