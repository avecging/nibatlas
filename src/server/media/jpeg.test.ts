// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectJpeg, processJpeg, orientPhoto, type PhotoImages, digest } from './jpeg';
import { hdrJpeg, grayGainMap, withGainMapAttribute, jpeg, progressiveJpeg, largeJpeg, profiledJpeg, adobeRgbJpeg, awkwardRatioJpeg, awkwardPortraitJpeg } from './jpeg.fixture';
import { validatePng, MAX_MEDIA_BYTES } from './png';
import { png } from './png.fixture';

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
  it.each([false,true])('extracts only the primary from a bounded HDR JPEG (little-endian %s)',little=>{
    const ordinary=withExif(jpeg,6), result=inspectJpeg(hdrJpeg(ordinary,jpeg,little));
    expect(result.bytes).toEqual(inspectJpeg(ordinary).bytes);
    expect(result).toMatchObject({width:24,height:16,orientation:6});
    for(const marker of ['MPF','hdr-gain-map','Exif','GPS','private'])expect(result.bytes.includes(Buffer.from(marker))).toBe(false);
  });
  it.each([false,true])('accepts a grayscale gain map with only an MP version attribute (%s)',little=>{
    expect(inspectJpeg(hdrJpeg(jpeg,withGainMapAttribute(grayGainMap,little),little)).bytes).toEqual(inspectJpeg(jpeg).bytes);
    expect(()=>inspectJpeg(grayGainMap)).toThrow(); // Grayscale primary still unsupported.
    const malformed=withGainMapAttribute(grayGainMap,little);
    malformed[malformed.indexOf(Buffer.from('0100'))]=50;
    expect(()=>inspectJpeg(hdrJpeg(jpeg,malformed))).toThrow();
    expect(()=>inspectJpeg(hdrJpeg(jpeg,withGainMapAttribute(withGainMapAttribute(grayGainMap))))).toThrow();
  });
  it('rejects malformed HDR indexes, overlaps, gaps, additional pictures and non-HDR MPO',()=>{
    const valid=hdrJpeg(), tiff=valid.indexOf(Buffer.from('MPF\0'))+4;
    const corrupt=(offset:number,value:number)=>{const b=Buffer.from(valid);b.writeUInt32BE(value,tiff+offset);return b;};
    for(const b of [corrupt(4,0xffffffff),corrupt(30,3),corrupt(42,0xfffffff0),
      corrupt(54,1),corrupt(74,1),corrupt(74,valid.readUInt32BE(tiff+74)+1),
      corrupt(70,0xffffffff),corrupt(58,1),corrupt(62,1),corrupt(66,0x30000),
      valid.subarray(0,-1),Buffer.concat([valid,jpeg]),Buffer.concat([jpeg,jpeg]),
      Buffer.from(valid.toString('latin1').replaceAll('hdr-gain-map','not-gain-map'),'latin1')]) expect(()=>inspectJpeg(b)).toThrow();
  });
  it('rejects oversized auxiliary frames and nested MPF indexes',()=>{
    expect(()=>inspectJpeg(hdrJpeg(jpeg,largeJpeg))).toThrow();
    expect(()=>inspectJpeg(hdrJpeg(jpeg,hdrJpeg()))).toThrow();
    expect(()=>inspectJpeg(hdrJpeg(largeJpeg,Buffer.alloc(MAX_MEDIA_BYTES)))).toThrow();
  });
  it.each([[1024,340],[1024,341]])('uses validated decoder dimensions %s x %s',async(width,height)=>{
    let options:unknown;
    const images:PhotoImages={input:()=>({transform:value=>{options=value;return {output:async()=>({response:()=>new Response(png(width,height),{headers:{'content-type':'image/png'}})})};}})};
    const result=await processJpeg(withExif(awkwardRatioJpeg,6),images);
    expect(options).toEqual({width:1024});
    expect(result.checked).toMatchObject({width:height,height:width});
  });
  it.each([[1025,341],[1023,340],[1024,339],[1024,342],[1024,1024]])('rejects wrong decoder scale/aspect %s x %s',async(width,height)=>{
    const images:PhotoImages={input:()=>({transform:()=>({output:async()=>({response:()=>new Response(png(width,height),{headers:{'content-type':'image/png'}})})})})};
    await expect(processJpeg(awkwardRatioJpeg,images)).rejects.toThrow();
  });
  it('retains only canonical Adobe colour interpretation for the decoder',()=>{
    const b=Buffer.from(adobeRgbJpeg), at=b.indexOf(Buffer.from('Adobe'));
    b.fill(0xab,at+5,at+11); // Version/flags are not needed for decoding.
    const clean=inspectJpeg(b).bytes, marker=clean.indexOf(Buffer.from('Adobe'));
    expect(marker).toBeGreaterThan(0);
    expect(clean.subarray(marker,marker+12)).toEqual(Buffer.from([65,100,111,98,101,0,100,0,0,0,0,0]));
  });
  it('rejects unsupported, malformed and duplicate Adobe declarations',()=>{
    const payload=Buffer.from([65,100,111,98,101,0,100,0,0,0,0,0]);
    for(const transform of [2,3,255]) {
      const b=Buffer.from(adobeRgbJpeg);b[b.indexOf(Buffer.from('Adobe'))+11]=transform;
      expect(()=>inspectJpeg(b)).toThrow();
    }
    for(const extra of [app(0xee,payload),app(0xee,payload.subarray(0,11)),app(0xee,Buffer.concat([payload,Buffer.from([0])]))]) {
      expect(()=>inspectJpeg(Buffer.concat([adobeRgbJpeg.subarray(0,2),extra,adobeRgbJpeg.subarray(2)]))).toThrow();
    }
  });
  it('rejects Adobe interpretation declared after image scans start',()=>{
    const start=adobeRgbJpeg.indexOf(Buffer.from([255,238]));
    const end=start+2+adobeRgbJpeg.readUInt16BE(start+2);
    const marker=adobeRgbJpeg.subarray(start,end);
    const without=Buffer.concat([adobeRgbJpeg.subarray(0,start),adobeRgbJpeg.subarray(end)]);
    const late=Buffer.concat([without.subarray(0,-2),marker,without.subarray(-2)]);
    expect(()=>inspectJpeg(late)).toThrow();
  });
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
  it.each([jpeg,progressiveJpeg,profiledJpeg,adobeRgbJpeg])('decodes and produces independently valid metadata-free bytes',async b=>{
    const original=withExif(b,6), result=await processJpeg(original,images);
    expect(result.checked).toMatchObject({width:16,height:24});
    expect(result.checked.sha256).not.toBe(digest(original));
    expect(validatePng(result.bytes,false)).toEqual(result.checked);
    for(const text of ['Exif','GPS','XMP','IPTC','secret','private']) expect(result.bytes.includes(Buffer.from(text))).toBe(false);
    // Top-left after clockwise rotation was the original blue bottom-left.
    const p=pixels(result.bytes).p;expect(p[2]).toBeGreaterThan(240);expect(p[0]).toBeLessThan(15);
  });
  it('decodes HDR primary pixels identically, preserving orientation and removing the gain map',async()=>{
    const ordinary=withExif(jpeg,6);
    const output=await processJpeg(hdrJpeg(ordinary),images);
    expect(output.bytes).toEqual((await processJpeg(ordinary,images)).bytes);
    expect(output.checked).toMatchObject({width:16,height:24});
    expect(output.bytes.includes(Buffer.from('hdr-gain-map'))).toBe(false);
  });
  it.each([0,1])('preserves Adobe transform %s colours and strips the marker from output',async transform=>{
    const marker=app(0xee,Buffer.from([65,100,111,98,101,0,100,0,0,0,0,transform]));
    const input=transform===0?adobeRgbJpeg:Buffer.concat([jpeg.subarray(0,2),marker,jpeg.subarray(2)]);
    const result=await processJpeg(input,images), decoded=pixels(result.bytes);
    for(const [x,y,expected] of [[2,2,[255,0,0]],[21,2,[0,255,0]],[2,13,[0,0,255]],[21,13,[255,255,0]]] as const) {
      const offset=(y*decoded.width+x)*4;
      expected.forEach((value,channel)=>expect(Math.abs(decoded.p[offset+channel]!-value)).toBeLessThan(20));
    }
    expect(result.bytes.includes(Buffer.from('Adobe'))).toBe(false);
    const chunks:string[]=[];
    for(let p=8;p<result.bytes.length;p+=result.bytes.readUInt32BE(p)+12) chunks.push(result.bytes.toString('ascii',p+4,p+8));
    expect(chunks).toEqual(['IHDR','IDAT','IEND']);
  });
  it('resizes without cropping or enlargement and then applies orientation',async()=>{
    const result=await processJpeg(withExif(largeJpeg,6),images);
    expect(result.checked).toMatchObject({width:512,height:1024});
    expect(validatePng(result.bytes,false)).toEqual(result.checked);
    expect(result.bytes.length).toBeLessThanOrEqual(MAX_MEDIA_BYTES);
  });
  it.each([[awkwardRatioJpeg,1024,340],[awkwardPortraitJpeg,340,1024]] as const)('accepts resized photos whose short edge rounds down',async(input,width,height)=>{
    const result=await processJpeg(input,images);
    expect(result.checked).toMatchObject({width,height});
  });
  it('rejects a scan referencing an invalid Huffman table',async()=>{
    const corrupt=Buffer.from(jpeg);const sos=corrupt.indexOf(Buffer.from([255,218]));
    corrupt[sos+6]=0xff;
    await expect(processJpeg(corrupt,images)).rejects.toThrow();
  });
});
