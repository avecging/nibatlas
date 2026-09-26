'use client';
import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './UploadField.module.css';

/** Shared presentation only. Each caller retains its file/validation contract. */
export function UploadField({label,accept,filename,help,disabled=false,status='',error='',onSelect,onClear,onRetry,retryLabel='Retry saving this file',children}: {
  label:string;accept:string;filename:string;help:ReactNode;disabled?:boolean;
  status?:string;error?:string;onSelect:(file:File)=>void;onClear?:()=>void;
  onRetry?:(()=>void)|undefined;retryLabel?:string;children?:ReactNode;
}) {
  const id=useId();
  return <div className={styles.field}>
    <label className={styles.picker}>
      {label}
      <span className={styles.selection}><span className={styles.button}>Choose file</span><span id={`${id}-name`} className={styles.name}>{filename || 'No file chosen'}</span></span>
      <input className={styles.input} type="file" accept={accept} aria-label={label}
        aria-describedby={`${id}-name ${id}-help${error ? ` ${id}-error` : ''}`}
        aria-invalid={error ? true : undefined} disabled={disabled} onChange={e=>{
          const file=e.target.files?.[0];
          // Own the visible filename so a retry/reselection of the same file
          // always fires change, without showing a contradictory native label.
          e.target.value='';if(file)onSelect(file);
        }}/>
    </label>
    <p id={`${id}-help`} className={styles.help}>{help}</p>
    {children}
    {status && <p role="status" className={styles.status}>{status}</p>}
    {error && <p id={`${id}-error`} role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      {onRetry && <button type="button" disabled={disabled} onClick={onRetry}>{retryLabel}</button>}
      {filename && onClear && <button type="button" disabled={disabled} onClick={onClear}>Clear selected file</button>}
    </div>
  </div>;
}
