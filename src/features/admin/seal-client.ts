import {object} from '@/src/domain/geographic-seals';
export async function sealApi(path:string,signal:AbortSignal,body?:unknown) {
 const r=await fetch(path,{signal,credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error(r.status===409?'This seal changed. Reload before saving or publishing.':r.status===422?'Check the name, place, artwork and creator credit.':r.status===403||r.status===401?'Sign in with an editor or admin account.':'Could not load or save seals. Please try again.');
 return object(await r.json());
}
