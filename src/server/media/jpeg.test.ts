// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectJpeg, processJpeg, orientPhoto, type PhotoImages, digest } from './jpeg';
import { jpeg, progressiveJpeg, largeJpeg, profiledJpeg } from './jpeg.fixture';
import { validatePng, MAX_MEDIA_BYTES } from './png';

export function app(marker:number,payload:Buffer) {
  const h=Buffer.alloc(4);h[0]=255;h[1]=marker;h.writeUInt16BE(payload.length+2,2);return Buffer.concat([h,payload]);
}
export function withExif(bytes:Buffer,orientation:number) {
  const t=Buffer.alloc(44);t.write('Exif\0\0');t.write('II',6);t.writeUInt16LE(42,8);t.writeUInt32LE(8,10);
  t.writeUInt16LE(2,14);t.writeUInt16LE(0x112,16);t.writeUInt16LE(3,18);t.writeUInt32LE(1,20);t.writeUInt16LE(orientation,24);
  t.writeUInt16LE(0x8825,28);t.writeUInt16LE(4,30);t.writeUInt32LE(1,32);t.writeUInt32LE(38,36);
  return Buffer.concat([bytes.subarray(0,2),app(0xe1,Buffer.concat([t,Buffer.from('GPS secret location')])),
    app(0xe1,Buffer.from('http://ns.adobe.com/xap/1.0/\0private XMP')),app(0xed,Buffer.from('private IPTC')),
    app(0xfe,Buffer.from('secret comment')),app(0xef,Buffer.from('arbitrary private metadata')),bytes.subarray(2)]);
}
function pixels(bytes:Uint8Array) {
  const m=validatePng(bytes,false), p=new Uint8Array(m.width*m.height*4);validatePng(bytes,false,p);return {p,...m};
}
describe('JPEG preflight and pixel orientation',()=>{
  it('accepts baseline and progressive and drops private segments before decoding',()=>{
    for(const b of [jpeg,progressiveJpeg]) {
      const inspected=inspectJpeg(withExif(b,6));expect(inspected).toMatchObject({width:24,height:16,orientation:6});
      expect(inspected.bytes.includes(Buffer.from('secret'))).toBe(false);
      expect(inspected.bytes.includes(Buffer.from('Exif'))).toBe(false);
    }
  });
  it('rejects duplicate and inconsistent ICC chunk sequences',()=>{
    const payload=Buffer.concat([Buffer.from('ICC_PROFILE\0'),Buffer.from([1,2,0])]);
    for(const extra of [app(0xe2,payload),Buffer.concat([app(0xe2,payload),app(0xe2,payload)])]) {
      expect(()=>inspectJpeg(Buffer.concat([jpeg.subarray(0,2),extra,jpeg.subarray(2)]))).toThrow();
    }
  });
  it('rejects truncation, trailing bytes, bad SOF, invalid orientation and resource limits',()=>{
    const big=Buffer.from(jpeg),sof=big.indexOf(Buffer.from([255,192]));big.writeUInt16BE(8193,sof+5);
    const bomb=Buffer.from(jpeg);bomb.writeUInt16BE(6000,sof+5);bomb.writeUInt16BE(6000,sof+7);
    const cmyk=Buffer.from(jpeg);cmyk[sof+9]=4;
    for(const b of [jpeg.subarray(0,-2),jpeg.subarray(0,100),Buffer.concat([jpeg,Buffer.from('x')]),big,bomb,cmyk,
      Buffer.alloc(MAX_MEDIA_BYTES+1),withExif(jpeg,0),withExif(jpeg,9),Buffer.from('<svg/>')]) expect(()=>inspectJpeg(b)).toThrow();
  });
  it.each([
    [1,[1,2,3,4,5,6]],[2,[3,2,1,6,5,4]],[3,[6,5,4,3,2,1]],[4,[4,5,6,1,2,3]],
    [5,[1,4,2,5,3,6]],[6,[4,1,5,2,6,3]],[7,[6,3,5,2,4,1]],[8,[3,6,2,5,1,4]],
  ])('applies orientation %s to exact asymmetric pixels',(orientation,expected)=>{
    const rgba=new Uint8Array([1,2,3,4,5,6].flatMap(x=>[x,0,0,255]));
    const out=pixels(orientPhoto(rgba,3,2,orientation as number));
    expect(Array.from(out.p).filter((_,i)=>i%4===0)).toEqual(expected);
    expect([out.width,out.height]).toEqual((orientation as number)>=5?[2,3]:[3,2]);
  });
});

// Wrangler's installed local Images emulator does actual decoding/re-encoding.
// No native image dependency is imported by application/Worker code.
describe('actual local Cloudflare Images binding',()=>{
  let images:PhotoImages, dispose:()=>Promise<void>,dir:string;
  beforeAll(async()=>{
    dir=await mkdtemp(join(tmpdir(),'nibatlas-images-'));
    const path=join(dir,'wrangler.json');await writeFile(path,JSON.stringify({name:'jpeg-test',compatibility_date:'2026-08-18',images:{binding:'PHOTO_IMAGES'}}));
    const require=createRequire(import.meta.url);
    const wrangler=require('wrangler') as {getPlatformProxy(options:unknown):Promise<{env:{PHOTO_IMAGES:PhotoImages};dispose:()=>Promise<void>}>};
    const proxy=await wrangler.getPlatformProxy({configPath:path,persist:false});images=proxy.env.PHOTO_IMAGES;dispose=proxy.dispose;
  },30000);
  afterAll(async()=>{await dispose?.();if(dir) await rm(dir,{recursive:true,force:true});});
  it.each([jpeg,progressiveJpeg,profiledJpeg])('decodes and produces independently valid metadata-free bytes',async b=>{
    const original=withExif(b,6), result=await processJpeg(original,images);
    expect(result.checked).toMatchObject({width:16,height:24});
    expect(result.checked.sha256).not.toBe(digest(original));
    expect(validatePng(result.bytes,false)).toEqual(result.checked);
    for(const text of ['Exif','GPS','XMP','IPTC','secret','private']) expect(result.bytes.includes(Buffer.from(text))).toBe(false);
    // Top-left after clockwise rotation was the original blue bottom-left.
    const p=pixels(result.bytes).p;expect(p[2]).toBeGreaterThan(240);expect(p[0]).toBeLessThan(15);
  });
  it('resizes without cropping or enlargement and then applies orientation',async()=>{
    const result=await processJpeg(withExif(largeJpeg,6),images);
    expect(result.checked).toMatchObject({width:512,height:1024});
    expect(validatePng(result.bytes,false)).toEqual(result.checked);
    expect(result.bytes.length).toBeLessThanOrEqual(MAX_MEDIA_BYTES);
  });
  it('rejects a scan referencing an invalid Huffman table',async()=>{
    const corrupt=Buffer.from(jpeg);const sos=corrupt.indexOf(Buffer.from([255,218]));
    corrupt[sos+6]=0xff;
    await expect(processJpeg(corrupt,images)).rejects.toThrow();
  });
});
