// @vitest-environment node
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {renderSealSvg,validateSealSvg} from './seal-artwork';
const svg=(s:string)=>new TextEncoder().encode(s);
const wrap=(s:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">${s}</svg>`;
describe('static SVG intake',()=>{
 it('accepts self-contained vector artwork with paths and text intact',()=>{const b=svg(wrap('<g fill="#123456"><path d="M0 0L100 100Z"/><text x="20" y="30">Gin &amp; friends</text></g>'));expect(validateSealSvg(b)).toMatchObject({byteSize:b.length,sha256:expect.stringMatching(/^[a-f0-9]{64}$/)});});
 it.each(['<script>alert(1)</script>','<image href="https://example.com/x"/>','<g onload="alert(1)"/>','<foreignObject/>','<style>path{fill:url(https://example.com)}</style>','<path fill="url(https://example.com)"/>','<use href="#a"/>','<path fill="&#114;ed"/>','<g><path/></svg>','<g xmlns="http://www.w3.org/1999/xhtml"/>'])('rejects unsafe or malformed markup %s',s=>expect(()=>validateSealSvg(svg(wrap(s)))).toThrow());
 it('rejects document entities, multiple roots, unbounded sizes and malformed UTF8',()=>{
  for(const b of [svg('<!DOCTYPE svg [<!ENTITY e SYSTEM "file:///etc/passwd">]>'+wrap('')),svg(wrap('')+wrap('')),svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 99999 400"/>'),new Uint8Array([255]),new Uint8Array(512*1024+1)])expect(()=>validateSealSvg(b)).toThrow();
 });
 it('allows only local clip references',()=>expect(()=>validateSealSvg(svg(wrap('<defs><clipPath id="clip"><rect width="10" height="10"/></clipPath></defs><path clip-path="url(#clip)" d="M0 0L10 10"/>')))).not.toThrow());
});

it('accepts safe inline presentation styles and comments without permitting CSS resources',()=>{
 const b=svg('<?xml version="1.0" encoding="UTF-8" standalone="no"?>'+wrap('<!-- Exported by an editor --><path fill="red" style="fill: #061F38; stroke: none; opacity: .5" d="M0 0L10 10"/>'));
 expect(()=>validateSealSvg(b)).not.toThrow();
 const output=renderSealSvg(b);expect(output).toContain('fill="#061F38"');expect(output).toContain('opacity=".5"');expect(output).not.toContain('style=');expect(output).not.toContain('<!--');
 for(const style of ['fill:url(https://example.com/x)','filter:url(#x)','fill:var(--external)','background-image:url(x)','fill:red;behavior:evil','fill: red !important'])expect(()=>validateSealSvg(svg(wrap(`<path style="${style}"/>`)))).toThrow();
});
it('pins palette RGB and retains source alpha in a versioned display treatment',()=>{
 const b=svg(wrap('<path fill="#061F38" opacity=".5" d="M0 0L20 20Z"/>'));
 const rendered=renderSealSvg(b,'teal');
 expect(rendered).toContain('color-interpolation-filters="sRGB"');expect(rendered).toContain('0 0 0 1 0');
 expect(rendered).toContain('opacity=".5"');expect(renderSealSvg(b)).not.toContain('feColorMatrix');
 expect(renderSealSvg(b,'plum')).not.toBe(rendered);expect(new TextDecoder().decode(b)).not.toContain('feColorMatrix');
});

it('accepts the founder’s exact six-path export and renders each selected ink',()=>{
 const bytes=readFileSync('tests/fixtures/seal-monochrome.svg');
 expect(validateSealSvg(bytes).sha256).toBe('45a7018fd2506370b2177621ba25f3c5c3616a404e5d1df22bf948e8dc00a1f9');
 for(const ink of ['teal','plum','navy'] as const){const rendered=renderSealSvg(bytes,ink);expect(rendered.match(/<path /g)).toHaveLength(6);expect(rendered).toContain('feColorMatrix');}
});

it('resolves filter IDs using bounded node IDs, not arbitrary document text',()=>{
 const b=svg(wrap(`<desc>nibatlas-ink-v1${'x'.repeat(100000)}</desc><path id="nibatlas-ink-v1" d="M0 0L20 20Z"/>`));
 const out=renderSealSvg(b,'teal');expect(out).toContain('<filter id="nibatlas-ink-v1-1"');expect(out).toContain('filter="url(#nibatlas-ink-v1-1)"');
});

it('keeps legacy duplicate-ID documents readable while avoiding generated ID collisions',()=>{
 const b=svg(wrap('<path id="nibatlas-ink-v1" d="M0 0L20 20Z"/><path id="nibatlas-ink-v1" d="M40 0L60 20Z"/>'));
 expect(()=>validateSealSvg(b)).not.toThrow();expect(renderSealSvg(b,'teal')).toContain('<filter id="nibatlas-ink-v1-1"');
});
