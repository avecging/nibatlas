import type { ShopStampDesign } from '@/src/domain/shop-detail';
import { STAMP_INK_HEX } from '@/src/domain/stamp-palette';
import { fitStampTitle } from './stamp-title';
import styles from './StampArt.module.css';
/** Version 1 is frozen for historical impressions. Future layouts need new IDs. */
export function GeographicSealArt({stamp,title,subtitle}:{stamp:ShopStampDesign;title:string;subtitle?:string|undefined}) {
 const fit=fitStampTitle({title:title.toLocaleUpperCase('en'),maxWidth:420,sizes:[48,42,36,30,24,18,14,10],maxLines:2});
 const nameY=210-(fit.lines.length-1)*fit.lineHeight/2;
 return <figure className={styles.stamp}><svg className={styles.canvas} viewBox="0 0 600 400" role="img" aria-label={`${stamp.tier} seal, ${title}${subtitle?`, ${subtitle}`:''}`} style={{color:STAMP_INK_HEX[stamp.ink]}}>
  <g fill="none" stroke="currentColor">
   <path strokeWidth="3" d="M130 67 Q82 67 82 115 Q36 138 36 200 Q36 262 82 285 Q82 333 130 333 H470 Q518 333 518 285 Q564 262 564 200 Q564 138 518 115 Q518 67 470 67 Z"/>
   <path strokeWidth="1.2" d="M134 78 Q94 78 94 123 Q49 144 49 200 Q49 256 94 277 Q94 322 134 322 H466 Q506 322 506 277 Q551 256 551 200 Q551 144 506 123 Q506 78 466 78 Z"/>
   <path strokeWidth="1.4" d="M139 91 H256 M344 91 H461 M139 309 H261 M339 309 H461 M113 146 H243 M357 146 H487 M113 260 H243 M357 260 H487"/>
   <path strokeWidth="1.6" d="M300 58 Q319 77 300 103 Q281 77 300 58 Z M300 83 V104 M283 323 L300 338 L317 323 M292 330 L300 318 L308 330"/>
   <circle cx="300" cy="81" r="3"/><path d="M66 184 L74 200 L66 216 L58 200 Z M534 184 L542 200 L534 216 L526 200 Z"/>
  </g>
  <g fill="currentColor" textAnchor="middle" fontFamily="var(--font-source-serif), Georgia, serif">
   <text x="300" y="133" fontSize="15" letterSpacing="4">NIB ATLAS · {stamp.tier==='country'?'COUNTRY':'LOCALITY'}</text>
   <text fontSize={fit.fontSize}>{fit.lines.map((line,i)=><tspan key={i} x="300" y={nameY+i*fit.lineHeight}>{line}</tspan>)}</text>
   <text x="300" y="287" fontSize="18" letterSpacing="2">{subtitle??'VERIFIED VISITS'}</text>
  </g>
 </svg></figure>;
}
