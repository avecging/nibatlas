import { useId } from 'react';
import type { ShopStampDesign } from '@/src/domain/shop-detail';
import { STAMP_INK_HEX } from '@/src/domain/stamp-palette';
import { NibAtlasMark } from '@/src/components/brand/NibAtlasMark';
import { estimateTextEms, fitStampTitle } from './stamp-title';
import styles from './StampArt.module.css';

// Frozen, deterministic cutouts: no random rendering or expensive turbulence filter.
const wear = Array.from({ length: 1400 }, (_, i) => {
  const x = 220 + ((i * 719) % 1360);
  const y = 100 + ((i * 137) % 585);
  const r = 0.7 + (i % 5) * 0.3;
  return `M${x} ${y}h${r * 2}v${r}h-${r * 2}z`;
}).join('');

/** cartouche-v2 is frozen. New artwork must receive a new template ID. */
export function GeographicSealArtV2({ stamp, title, subtitle }: {
  stamp: ShopStampDesign; title: string; subtitle?: string | undefined;
}) {
  const locality = stamp.tier === 'locality';
  const scope = locality ? 'Locality' : 'Country';
  const parent = fitStampTitle({title: stamp.countryLabel.toLocaleUpperCase('en'), maxWidth: 1000, sizes: [32, 28, 24, 20, 16], maxLines: 1});
  const id = useId().replace(/:/g, '');
  const ornaments = `${id}-ornaments`, distress = `${id}-wear`;
  const fit = fitStampTitle({
    title: title.toLocaleUpperCase('en'), maxWidth: 1000 / 0.85,
    sizes: /\s/.test(title.trim()) ? [150, 140, 128, 116, 104, 92, 80, 68, 56, 44, 32, 24, 16] : [190, 180, 170, 160, 150, 140, 128, 116, 104, 92, 80, 68, 56, 44, 32, 24, 16],
    maxLines: /\s/.test(title.trim()) ? 2 : 1,
  });
  const firstBaseline = fit.lines.length === 1 ? (locality ? 470 : 500) : locality ? 325 : 350;
  return <figure className={styles.stamp}>
    <svg className={styles.canvas} viewBox="0 0 1774 887" role="img"
      aria-label={`${scope} seal, ${title}, verified visits${subtitle ? `, ${subtitle}` : ''}`}
      style={{ color: STAMP_INK_HEX[stamp.ink] }} data-seal-template="cartouche-v2">
      <defs>
        <path id={`${id}-brand`} d="M345 590 A150 150 0 0 1 345 290" />
        <path id={`${id}-heading`} d="M600 168 Q887 98 1174 168" />
        <mask id={ornaments} maskUnits="userSpaceOnUse" x="0" y="0" width="1774" height="887" style={{ maskType: 'alpha' }}>
          <image href={`/stamps/cartouche-v2-${locality ? 'locality' : 'country'}.svg`} width="1774" height="887" />
        </mask>
        <mask id={distress} maskUnits="userSpaceOnUse" x="0" y="0" width="1774" height="887">
          <rect width="1774" height="887" fill="white" />
          <path d={wear} fill="black" />
        </mask>
      </defs>
      <rect width="1774" height="887" fill="currentColor" mask={`url(#${ornaments})`} />
      <g mask={`url(#${distress})`}>
        <g transform="translate(230 325)"><NibAtlasMark size={230} tone="single" /></g>
        <g fill="currentColor" textAnchor="middle" className={styles.countrySealType}>
          <text fontSize="42" letterSpacing="12"><textPath href={`#${id}-heading`} startOffset="50%">{scope.toUpperCase()}</textPath></text>
          <text fontSize="28" letterSpacing="5"><textPath href={`#${id}-brand`} startOffset="50%">NIB ATLAS</textPath></text>
          <text fontSize={fit.fontSize}>
            {fit.lines.map((line, i) => <tspan key={i} x="1030" y={firstBaseline + i * fit.lineHeight}
              textLength={Math.min(1000, estimateTextEms(line) * fit.fontSize * 0.85)} lengthAdjust="spacingAndGlyphs">{line}</tspan>)}
          </text>
          {locality ? <text fontSize={parent.fontSize} letterSpacing="2">{parent.lines.map((line, i) => <tspan key={i} x="1030" y={552 + i * parent.lineHeight} textLength={Math.min(1000, estimateTextEms(line) * parent.fontSize)} lengthAdjust="spacingAndGlyphs">{line}</tspan>)}</text> : null}
          <text x="1030" y={locality ? 615 : 594} fontSize="32" letterSpacing="7">VERIFIED VISITS</text>
        </g>
      </g>
    </svg>
    {subtitle ? <figcaption>{subtitle}</figcaption> : null}
  </figure>;
}
