import { useId } from 'react';
import { NibAtlasMark } from '@/src/components/brand/NibAtlasMark';
import type { ShopStampDesign } from '@/src/domain/shop-detail';
import { STAMP_INK_HEX } from '@/src/domain/stamp-palette';
import type { ShopSealShape } from '@/src/domain/shop-seal';
import { estimateTextEms, fitStampTitle } from './stamp-title';
import styles from './StampArt.module.css';

const wear = Array.from({length: 1700}, (_, i) => {
  const x = (i * 13729 % 90000) / 100, y = (i * 7193 % 51000) / 100, r = .45 + (i % 4) * .28;
  return `M${x} ${y}h${r * 2}v${r}h-${r * 2}z`;
}).join('');

/** Frozen shop-seal-v1 artwork. Never change an already-issued template in place. */
export function ShopSealArt({stamp, title, subtitle, shape}: {
  stamp: ShopStampDesign; title: string; subtitle?: string | undefined; shape: ShopSealShape;
}) {
  const id = useId().replace(/:/g, '');
  const name = fitStampTitle({title: title.toLocaleUpperCase('en'), maxWidth: 475,
    sizes: [54, 50, 46, 42, 38, 34, 30, 26, 22, 18, 14, 10, 8, 6, 4, 3, 2], maxLines: 2});
  const country = stamp.countryLabel.toLocaleUpperCase('en');
  return <figure className={styles.stamp}>
    <svg className={styles.canvas} viewBox="0 0 900 510" role="img"
      aria-label={`Shop seal, ${title}, ${stamp.countryLabel}, verified visits${subtitle ? `, ${subtitle}` : ''}`}
      style={{color: STAMP_INK_HEX[stamp.ink], fontFamily: "Georgia, 'Times New Roman', serif"}}
      data-shop-seal-template="shop-seal-v1" data-shop-seal-shape={shape}>
      <defs>
        <path id={`${id}-brand`} d="M204 322 A76 76 0 0 1 204 170"/>
        <path id={`${id}-heading`} d="M330 130 Q450 96 570 130"/>
        <mask id={`${id}-wear`} maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="510">
          <rect width="900" height="510" fill="white"/><path d={wear} fill="black"/>
        </mask>
      </defs>
      <g mask={`url(#${id}-wear)`}>
        <g fill="none" stroke="currentColor">
          {shape === 'shield' ? <><path strokeWidth="7" d="M55 80 Q450 35 845 80 L845 280 C845 362 670 396 450 468 C230 396 55 362 55 280 Z"/><path strokeWidth="2.5" d="M72 96 Q450 54 828 96 L828 278 C828 347 660 382 450 450 C240 382 72 347 72 278 Z"/></> :
            shape === 'oval' ? <><ellipse cx="450" cy="255" rx="407" ry="213" strokeWidth="7"/><ellipse cx="450" cy="255" rx="391" ry="198" strokeWidth="2.5"/></> :
              <><rect x="55" y="67" width="790" height="377" rx="5" strokeWidth="7"/><rect x="70" y="82" width="760" height="347" rx="2" strokeWidth="2.5"/></>}
        </g>
        <g transform="translate(151 193)"><NibAtlasMark size={108} tone="single"/></g>
        <g fill="currentColor" textAnchor="middle">
          <text fontSize="18" letterSpacing="2.8"><textPath href={`#${id}-brand`} startOffset="50%">NIB ATLAS</textPath></text>
          <text fontSize="25" letterSpacing="7"><textPath href={`#${id}-heading`} startOffset="50%">SHOP</textPath></text>
          <text fontSize={name.fontSize} fontWeight="bold">{name.lines.map((line, i) =>
            <tspan key={i} x="530" y={name.lines.length === 1 ? 267 : 239 + i * name.lineHeight}
              textLength={Math.min(475, estimateTextEms(line) * name.fontSize)} lengthAdjust="spacingAndGlyphs">{line}</tspan>)}</text>
          <text x="530" y="320" fontSize="21" letterSpacing="3"
            textLength={Math.min(475, estimateTextEms(country) * 21 + Math.max(0, country.length - 1) * 3)} lengthAdjust="spacingAndGlyphs">{country}</text>
          <text x="530" y="366" fontSize="20" letterSpacing="3.5">VERIFIED VISITS</text>
        </g>
      </g>
    </svg>
    {subtitle ? <figcaption>{subtitle}</figcaption> : null}
  </figure>;
}
