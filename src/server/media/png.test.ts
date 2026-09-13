// @vitest-environment node
import { describe,it,expect } from 'vitest';
import { deflateSync } from 'node:zlib';
import { validatePng, MAX_MEDIA_BYTES, readBounded } from './png';
import { png } from './png.fixture';
describe('strict PNG intake',()=>{
  it('validates bytes, dimensions and hash without changing them',()=>{
    const bytes=png(), before=Buffer.from(bytes);
    expect(validatePng(bytes,false)).toMatchObject({width:2,height:2,byteSize:bytes.length});
    expect(validatePng(bytes,false).sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(bytes.equals(before)).toBe(true);
  });
  it('accepts the transparent artwork canvas unchanged',()=>expect(validatePng(png(1200,800),true)).toMatchObject({width:1200,height:800}));
  it.each(['eXIf','tEXt','iTXt','zTXt','acTL','iCCP','sRGB','PLTE'])('rejects unsupported/metadata chunk %s',type=>expect(()=>validatePng(png(2,2,{metadata:type}),false)).toThrow());
  it.each([1,2,3,4])('decodes filter %s',filter=>expect(validatePng(png(2,2,{filter}),false).width).toBe(2));
  it('rejects forged signature/CRC and truncation',()=>{
    const bytes=png(); bytes[45]=bytes[45]!^1;
    for (const value of [bytes,png().subarray(0,40),Buffer.from('<svg/>'),Buffer.concat([png(),Buffer.from('payload')])]) expect(()=>validatePng(value,false)).toThrow();
  });
  it('rejects decompression bombs, short rows, invalid filters and zlib trailers',()=>{
    for (const value of [png(2,2,{raw:Buffer.alloc(100)}),png(2,2,{raw:Buffer.alloc(10)}),png(2,2,{filter:5}),
      png(2,2,{compressed:Buffer.concat([deflateSync(Buffer.alloc(18)),Buffer.from('extra')])})]) expect(()=>validatePng(value,false)).toThrow();
  });
  it('enforces limits and artwork transparency/canvas',()=>{
    for (const [bytes,art] of [[Buffer.alloc(MAX_MEDIA_BYTES+1),false],[png(2049,1),false],[png(),true],[png(1200,800,{opaque:true}),true]] as const) expect(()=>validatePng(bytes,art)).toThrow();
  });
  it('bounds actual streamed bytes without trusting Content-Length',async()=>{
    let cancelled=false;
    const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(11));},cancel(){cancelled=true;}});
    await expect(readBounded(stream,10)).rejects.toThrow(); expect(cancelled).toBe(true);
  });
});
