'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAccountSession} from '@/src/features/account/AccountSessionProvider';
import type {AdminSeal} from '@/src/domain/geographic-seals';
import {CountryField} from './CountryField';
import {sealApi} from './seal-client';
import base from './ShopAdmin.module.css';
import styles from './SealAdmin.module.css';
export function SealAdmin(){const {session}=useAccountSession();return <Dashboard key={session.status==='signed-in'?session.userId:session.status}/>;}
function Dashboard(){
 const [rows,setRows]=useState<AdminSeal[]>([]),[next,setNext]=useState<string|null>(null),[after,setAfter]=useState<string|null>(null),[previous,setPrevious]=useState<(string|null)[]>([]);
 const [q,setQ]=useState(''),[scope,setScope]=useState(''),[country,setCountry]=useState(''),[filters,setFilters]=useState({q:'',scope:'',country:''});
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const c=new AbortController();const p=new URLSearchParams(filters);if(after)p.set('after',after);
  void sealApi(`/api/v1/admin/seals?${p}`,c.signal).then(r=>{if(!c.signal.aborted){setRows(r.entries as AdminSeal[]);setNext(r.nextCursor as string|null);}}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setBusy(false);});return()=>c.abort();
 },[filters,after,reload]);
 return <div className={base.admin}><nav aria-label="Administration"><Link href="/admin/shops">Shops</Link> · Stamps &amp; seals</nav>
  <header className={styles.header}><div><h1>Stamps &amp; seals</h1><p>Manage geographic seals. Shop artwork is managed in <Link href="/admin/shops">Shops</Link>.</p></div><Link className={styles.add} href="/admin/seals/new">Add new seal</Link></header>
  <form className={styles.filters} onSubmit={e=>{e.preventDefault();setBusy(true);setError('');setAfter(null);setPrevious([]);setFilters({q:q.trim(),scope,country});}}>
   <label>Search seals<input value={q} onChange={e=>setQ(e.target.value)} maxLength={100} placeholder="Name, country or locality"/></label>
   <label>Scope<select value={scope} onChange={e=>setScope(e.target.value)}><option value="">All scopes</option><option value="country">Country</option><option value="locality">Locality</option></select></label>
   <CountryField value={country} onChange={value=>setCountry(value??'')}/><button disabled={busy}>Apply filters</button>
  </form>
  {error?<p role="alert">{error} <button onClick={()=>{setBusy(true);setError('');setReload(v=>v+1);}}>Retry</button></p>:null}
  <p role="status">{busy?'Loading seals…':`${rows.length} seals on this page`}</p>
  <div className={styles.tableWrap}><table className={styles.table}><caption className="visually-hidden">Geographic seal management</caption><thead><tr><th>Name</th><th>Scope</th><th>Country / locality</th><th>Version</th><th>Action</th></tr></thead><tbody>
   {!busy&&!rows.length?<tr><td colSpan={5}>No seals match these filters.</td></tr>:null}
   {rows.map(s=><tr key={s.id}><td><span className={styles.name}>{s.draft.name||s.localityName||s.draft.countryLabel}</span><span className={styles.meta}>{s.published?'Published':'Private'}</span></td>
    <td><span className={`${styles.scope} ${s.draft.scope==='country'?styles.country:''}`}>{s.draft.scope==='country'?'Country':'Locality'}</span></td>
    <td>{s.draft.countryLabel}{s.draft.scope==='locality'?<span className={styles.meta}>{s.localityName}</span>:null}</td><td>{s.publishedVersion?`v${s.publishedVersion}`:'Draft'}</td><td><Link href={`/admin/seals/${s.id}`} aria-label={`Edit ${s.draft.name||s.localityName||s.draft.countryLabel} ${s.draft.scope} seal`}>Edit</Link></td></tr>)}
  </tbody></table></div>
  <div className={styles.pagination}><button disabled={busy||!previous.length} onClick={()=>{setBusy(true);setError('');setAfter(previous.at(-1)??null);setPrevious(p=>p.slice(0,-1));}}>Previous</button><span>Page {previous.length+1}</span><button disabled={busy||!next} onClick={()=>{setBusy(true);setError('');setPrevious(p=>[...p,after]);setAfter(next);}}>Next</button></div>
 </div>;
}
