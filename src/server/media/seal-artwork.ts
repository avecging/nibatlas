import {createHash} from 'node:crypto';
import {STAMP_INK_HEX,type StampInk} from '@/src/domain/stamp-palette';
import {InvalidMedia,validatePng} from './png';
export const MAX_SEAL_SVG_BYTES=512*1024;
export class SealArtworkFormatMismatch extends InvalidMedia {}
const elements=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc','defs','clipPath']);
const attrs=new Set(['xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','transform','id','clip-path','font-family','font-size','font-weight','text-anchor','letter-spacing','dominant-baseline','preserveAspectRatio','version']);
function invalid():never{throw new InvalidMedia('Unsupported SVG. Export self-contained paths and text without scripts, style sheets, images or external resources.');}
const presentation=new Set(['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','font-family','font-size','font-weight','text-anchor','letter-spacing','dominant-baseline']);
function safeValue(key:string,v:string){
 if(key==='clip-path'){if(!/^url\(#[A-Za-z][\w.-]*\)$/.test(v))invalid();}
 else if(key==='fill'||key==='stroke'){if(!/^(?:none|currentColor|#[a-fA-F0-9]{3,8}|[a-zA-Z]+|rgba?\([\d.,%\s]+\))$/.test(v))invalid();}
 else if(/url|https?:|data:|javascript:|@|;|\{|\}/i.test(v))invalid();
}
/** Strict, bounded static SVG grammar. No recovery, DOM injection, stylesheets, hrefs or entities.
 * Accept bytes intact only when every token and attribute is in this inert subset.
 */
function parseSealSvg(bytes:Uint8Array){
 if(!bytes.length||bytes.length>MAX_SEAL_SVG_BYTES)invalid();
 let source:string;try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return invalid();}
 const s=source.replace(/^\uFEFF/,'').replace(/^\s*<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']UTF-8["'])?(?:\s+standalone=["'](?:yes|no)["'])?\s*\?>/i,'');
 const token=/<!--[\s\S]*?-->|<\/?[A-Za-z][^<>]*>|[^<>]+/gy,stack:string[]=[];const output:string[]=[];const ids=new Set<string>();let end=0,roots=0,nodes=0;let viewBox:number[]=[];
 while(end<s.length){token.lastIndex=end;const m=token.exec(s);if(!m)invalid();const t=m[0];end=token.lastIndex;
  if(t.startsWith('<!--')){if(t.slice(4,-3).includes('--')||t.slice(4,-3).endsWith('-'))invalid();continue;}
  if(!t.startsWith('<')){if(!stack.length&&t.trim())invalid();if(/&(?!amp;|lt;|gt;|quot;|apos;)/.test(t))invalid();output.push(t);continue;}
  if(t.startsWith('</')){const close=/^<\/([A-Za-z]+)\s*>$/.exec(t);if(!close||stack.pop()!==close[1])invalid();output.push(`</${close[1]}>`);continue;}
  const open=/^<([A-Za-z]+)([\s\S]*?)(\/?)>$/.exec(t);if(!open||!elements.has(open[1]!)||++nodes>2000)invalid();
  const tag=open[1]!,tail=open[2]!,self=!!open[3];
  if(!stack.length){if(tag!=='svg'||++roots>1)invalid();}else if(tag==='svg')invalid();
  const attribute=/\s+([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/gy;let at=0;const seen=new Set<string>(),values:Record<string,string>={},inline:Record<string,string>={};
  while(at<tail.length){if(!tail.slice(at).trim())break;attribute.lastIndex=at;const a=attribute.exec(tail);if(!a)invalid();at=attribute.lastIndex;const key=a[1]!,v=a[2]??a[3]??'';
   if((!attrs.has(key)&&key!=='style')||seen.has(key)||/[&\\\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))invalid();seen.add(key);
   if(key==='style'){
    for(const declaration of v.split(';')){if(!declaration.trim())continue;const pair=/^\s*([a-z-]+)\s*:\s*(.+?)\s*$/.exec(declaration);if(!pair||!presentation.has(pair[1]!))invalid();safeValue(pair[1]!,pair[2]!);inline[pair[1]!]=pair[2]!;}
    continue;
   }
   values[key]=v;
   if(key==='xmlns'){if(tag!=='svg'||v!=='http://www.w3.org/2000/svg')invalid();}
   else safeValue(key,v);
  }
  Object.assign(values,inline);
  if(values.id)ids.add(values.id);
  if(tag==='svg'){
   if(values.xmlns!=='http://www.w3.org/2000/svg')invalid();
   const box=values.viewBox?.trim().split(/[\s,]+/).map(Number);
   if(!box||box.length!==4||box.some(v=>!Number.isFinite(v))||box[2]!<=0||box[3]!<=0||box[2]!>2048||box[3]!>2048)invalid();
   viewBox=box;
   for(const dimension of ['width','height'])if(values[dimension]&&!/^(?:\d+(?:\.\d+)?)(?:px)?$/.test(values[dimension]!))invalid();
  }
  const serial=Object.entries(values).map(([k,v])=>` ${k}="${v.replace(/"/g,'&quot;')}"`).join('');
  output.push(`<${tag}${serial}${self&&tag!=='svg'?'/':''}>${self&&tag==='svg'?'</svg>':''}`);
  if(!self){stack.push(tag);if(stack.length>32)invalid();}
 }
 if(roots!==1||stack.length)invalid();
 return {source:output.join(''),viewBox,ids};
}
export function validateSealSvg(bytes:Uint8Array){
 parseSealSvg(bytes);
 return {sha256:createHash('sha256').update(bytes).digest('hex'),byteSize:bytes.length};
}
/** Frozen ink-v1 display treatment. Stored source and legacy impressions stay intact.
 * Inline presentation styles become attributes so delivery needs no CSS permission.
 * The matrix replaces RGB in sRGB space and leaves alpha/cutouts unchanged.
 */
export function renderSealSvg(bytes:Uint8Array,ink?:StampInk){
 const {source,viewBox,ids}=parseSealSvg(bytes);
 if(!ink)return source;
 const hex=STAMP_INK_HEX[ink];if(!hex)invalid();
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 let suffix=0,id='nibatlas-ink-v1';while(ids.has(id))id=`nibatlas-ink-v1-${++suffix}`;
 const at=source.indexOf('>')+1;
 const filter=`<defs><filter id="${id}" filterUnits="userSpaceOnUse" x="${viewBox[0]}" y="${viewBox[1]}" width="${viewBox[2]}" height="${viewBox[3]}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 1 0"/></filter></defs>`;
 return source.slice(0,at)+filter+`<g filter="url(#${id})">`+source.slice(at).replace(/<\/svg>\s*$/,'</g></svg>');
}
export function validateSealArtwork(bytes:Uint8Array,type:string){
 if(type==='image/png'){
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)throw new SealArtworkFormatMismatch('JPEG content supplied as PNG');
  return validatePng(bytes,false);
 }
 if(type==='image/svg+xml')return validateSealSvg(bytes);
 return invalid();
}
