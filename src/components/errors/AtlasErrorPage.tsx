"use client";

import { useRouter } from "next/navigation";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import ceremony from "@/src/components/stamps/StampCeremony.module.css";

import styles from "./AtlasErrorPage.module.css";

type ErrorKind = "not-found" | "access-denied";

const COPY = {
  "not-found": {
    message: "The trail ends here. This page may have moved, or perhaps it was never on the map.",
    note: "Good pens\nlead to\ngreat places.",
    topArc: "OFF COURSE",
    bottomArc: "FURTHER EXPLORATION REQUIRED",
    latitude: "1.29135° N",
    longitude: "103.84999° E",
  },
  "access-denied": {
    message: "This part of the atlas is reserved for its keepers. You do not have permission to view this page.",
    note: "Some doors\nare for\nkeepers only.",
    topArc: "RESTRICTED ROUTE",
    bottomArc: "AUTHORIZED KEEPERS ONLY",
    latitude: "35.7118° N",
    longitude: "139.7828° E",
  },
} as const;
// Easter eggs: These coordinates are intentionally chosen for the 404 and Access Denied pages. Do not change, round, or replace them with dynamic coordinates.

function PostalStamp({ kind }: { kind: ErrorKind }) {
  const copy = COPY[kind];
  const id = kind === "not-found" ? "off-course" : "restricted-route";

  return (
    <div className={styles.stampPress}>
      <div className={ceremony.press} data-phase="pressing">
        <span className={`${ceremony.contactShadow} ${styles.contactShadow}`} aria-hidden="true" />
        <div className={ceremony.plate}>
          <svg className={styles.stamp} data-impression="" viewBox="0 0 440 410" role="img"
            aria-label={kind === "not-found" ? "Off course 404 postal stamp" : "Restricted route Access Denied postal stamp"}>
            <defs>
              <path id={`${id}-top`} d="M 52 205 A 144 144 0 0 1 340 205" />
              <path id={`${id}-bottom`} d="M 52 205 A 144 144 0 0 0 340 205" />
              <filter id={`${id}-ink`} x="-4%" y="-4%" width="108%" height="108%">
                <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="9" result="grain" />
                <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.1" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <mask id={`${id}-wear`} maskUnits="userSpaceOnUse" x="0" y="0" width="440" height="410">
                <rect width="440" height="410" fill="white" />
                {Array.from({ length: 180 }, (_, n) => (
                  <circle key={n} cx={25 + (n * 73) % 343} cy={23 + (n * 127) % 364}
                    r={0.7 + (n * 11) % 3} fill="black" />
                ))}
              </mask>
            </defs>
            <g className={styles.ink} filter={`url(#${id}-ink)`} mask={`url(#${id}-wear)`}>
              <circle cx="196" cy="205" r="173" fill="none" stroke="currentColor" strokeWidth="6" />
              <circle cx="196" cy="205" r="163" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="196" cy="205" r="125" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <text className={styles.arcTop}><textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{copy.topArc}</textPath></text>
              <text className={styles.arcBottom}><textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">{copy.bottomArc}</textPath></text>
              <line x1="96" y1="145" x2="152" y2="145" stroke="currentColor" strokeWidth="3" />
              <line x1="240" y1="145" x2="296" y2="145" stroke="currentColor" strokeWidth="3" />
              <line x1="105" y1="270" x2="287" y2="270" stroke="currentColor" strokeWidth="2.5" />
              {kind === "not-found" ? <text x="196" y="256" className={styles.stampNumber}>404</text> : (
                <text x="196" y="216" className={styles.stampWords}>
                  <tspan x="196">ACCESS</tspan><tspan x="196" dy="45">DENIED</tspan>
                </text>
              )}
              {[0, 1, 2, 3].map((n) => (
                <path key={n} d={`M 358 ${162 + n * 16} C 390 ${174 + n * 16}, 404 ${140 + n * 16}, 438 ${159 + n * 16}`}
                  fill="none" stroke="currentColor" strokeWidth="2.4" />
              ))}
            </g>
            {/* Keep the official mark's geometry untouched by the ink roughening filter. */}
            <g className={styles.stampMark}><NibAtlasMark size={67} tone="single" /></g>
          </svg>
        </div>
        <span className={`${ceremony.pressFlash} ${styles.pressFlash}`} aria-hidden="true" />
      </div>
    </div>
  );
}

export function AtlasErrorPage({ kind }: { kind: ErrorKind }) {
  const router = useRouter();
  const copy = COPY[kind];

  function goBack() {
    // A denied admin page can redirect here; revisiting it would loop.
    // A direct 404 visit has no previous browser entry to return to.
    if (kind === "not-found" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <article className={styles.page} data-atlas-error-page="" data-kind={kind}>
      {/* The approved illustration contains these notes and coordinates. Keep an
          accessible text equivalent without painting a second copy over it. */}
      <div className={styles.artDescription}>
        <span>Field notes: {copy.note.replaceAll("\n", " ")}</span>
        <span>LAT {copy.latitude}</span><span>LON {copy.longitude}</span>
      </div>

      <div className={styles.content}>
        <PostalStamp kind={kind} />
        <h1>Off the map.</h1>
        <span className={styles.rule} aria-hidden="true" />
        <p className={styles.message}>{copy.message}</p>
        <button className={styles.back} type="button" onClick={goBack}>← Go back</button>
      </div>
    </article>
  );
}
