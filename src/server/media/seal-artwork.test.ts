// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {validateSealSvg} from './seal-artwork';
const svg=(s:string)=>new TextEncoder().encode(s);
const wrap=(s:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">${s}</svg>`;
describe('static SVG intake',()=>{
 it('accepts self-contained vector artwork with paths and text intact',()=>{const b=svg(wrap('<g fill="#123456"><path d="M0 0L100 100Z"/><text x="20" y="30">Gin &amp; friends</text></g>'));expect(validateSealSvg(b)).toMatchObject({byteSize:b.length,sha256:expect.stringMatching(/^[a-f0-9]{64}$/)});});
 it.each(['<script>alert(1)</script>','<image href="https://example.com/x"/>','<g onload="alert(1)"/>','<foreignObject/>','<style>path{fill:url(https://example.com)}</style>','<path style="fill:red"/>','<path fill="url(https://example.com)"/>','<use href="#a"/>','<path fill="&#114;ed"/>','<g><path/></svg>','<g xmlns="http://www.w3.org/1999/xhtml"/>'])('rejects unsafe or malformed markup %s',s=>expect(()=>validateSealSvg(svg(wrap(s)))).toThrow());
 it('rejects document entities, multiple roots, unbounded sizes and malformed UTF8',()=>{
  for(const b of [svg('<!DOCTYPE svg [<!ENTITY e SYSTEM "file:///etc/passwd">]>'+wrap('')),svg(wrap('')+wrap('')),svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 99999 400"/>'),new Uint8Array([255]),new Uint8Array(512*1024+1)])expect(()=>validateSealSvg(b)).toThrow();
 });
 it('allows only local clip references',()=>expect(()=>validateSealSvg(svg(wrap('<defs><clipPath id="clip"><rect width="10" height="10"/></clipPath></defs><path clip-path="url(#clip)" d="M0 0L10 10"/>')))).not.toThrow());
});
