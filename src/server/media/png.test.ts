// @vitest-environment node
import { describe,it,expect } from 'vitest';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { validatePng, MAX_MEDIA_BYTES, readBounded } from './png';
import { chunk, displayMetadata, png } from './png.fixture';
function uint32(value: number) { const b=Buffer.alloc(4); b.writeUInt32BE(value); return b; }
function density(x=3780,y=3780,unit=1) { return Buffer.concat([uint32(x),uint32(y),Buffer.from([unit])]); }
describe('strict PNG intake',()=>{
  it('validates bytes, dimensions and hash without changing them',()=>{
    const bytes=png(), before=Buffer.from(bytes);
    expect(validatePng(bytes,false)).toMatchObject({width:2,height:2,byteSize:bytes.length});
    expect(validatePng(bytes,false).sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(bytes.equals(before)).toBe(true);
  });
  it('accepts the transparent artwork canvas unchanged',()=>expect(validatePng(png(1200,800),true)).toMatchObject({width:1200,height:800}));
  it.each(['eXIf','tEXt','iTXt','zTXt','acTL','fcTL','fdAT','iCCP','tIME','vpAg','cHRM','PLTE'])('rejects unsupported/metadata chunk %s',type=>expect(()=>validatePng(png(2,2,{metadata:type}),false)).toThrow());
  it('accepts the reported 420x595 export structure without changing any bytes',()=>{
    // Reproduction of the reported structure, not the founder\'s private file.
    const bytes=png(420,595,{chunks:displayMetadata()}), before=Buffer.from(bytes);
    expect(validatePng(bytes,false)).toEqual({width:420,height:595,byteSize:bytes.length,
      sha256:createHash('sha256').update(before).digest('hex')});
    expect(bytes.equals(before)).toBe(true);
    expect(()=>validatePng(bytes,true)).toThrow(); // Photo size is not an artwork canvas.
  });
  it.each([0,1,2,3])('accepts sRGB intent %s alone',intent=>{
    expect(validatePng(png(2,2,{chunks:[chunk('sRGB',Buffer.from([intent]))]}),false).width).toBe(2);
  });
  it.each([1,45455,100000,0x7fffffff])('accepts standalone gamma %s',gamma=>{
    expect(validatePng(png(2,2,{chunks:[chunk('gAMA',uint32(gamma))]}),false).width).toBe(2);
  });
  it.each([density(),density(2,1,0),density(0,0,0),density(0x7fffffff,0x7fffffff)])('accepts bounded pixel density without using it as image dimensions',data=>{
    expect(validatePng(png(2,2,{chunks:[chunk('pHYs',data)]}),false)).toMatchObject({width:2,height:2});
  });
  it.each([[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]])('accepts legal display chunk order %s,%s,%s',(...order)=>{
    const metadata=displayMetadata();
    expect(validatePng(png(2,2,{chunks:order.map(i=>metadata[i]!)}),false).width).toBe(2);
  });
  it('keeps artwork size/transparency checks with display metadata',()=>{
    expect(validatePng(png(1200,800,{chunks:displayMetadata()}),true)).toMatchObject({width:1200,height:800});
    expect(()=>validatePng(png(1200,800,{chunks:displayMetadata(),opaque:true}),true)).toThrow();
  });
  it('accepts RGB display metadata but retains header format restrictions',()=>{
    const base=png(2,2,{chunks:displayMetadata()});
    const header=Buffer.from(base.subarray(16,29)); header[9]=2;
    const rgb=Buffer.concat([base.subarray(0,8),chunk('IHDR',header),...displayMetadata(),
      chunk('IDAT',deflateSync(Buffer.alloc(14))),base.subarray(-12)]);
    expect(validatePng(rgb,false)).toMatchObject({width:2,height:2});
    for(const [offset,value] of [[8,16],[9,3],[10,1],[11,1],[12,1]] as const) {
      const bad=Buffer.from(base.subarray(16,29)); bad[offset]=value;
      expect(()=>validatePng(Buffer.concat([base.subarray(0,8),chunk('IHDR',bad),base.subarray(33)]),false)).toThrow();
    }
  });
  it.each([
    ['sRGB',Buffer.alloc(0)],['sRGB',Buffer.from([4])],['sRGB',Buffer.from([255])],['sRGB',Buffer.from([0,0])],
    ['gAMA',Buffer.alloc(3)],['gAMA',Buffer.alloc(5)],['gAMA',uint32(0)],['gAMA',uint32(0x80000000)],
    ['pHYs',Buffer.alloc(8)],['pHYs',Buffer.alloc(10)],['pHYs',density(1,1,2)],
    ['pHYs',density(0x80000000,1)],['pHYs',density(1,0xffffffff)],
  ] as const)('rejects malformed %s display payload', (type,data)=>{
    expect(()=>validatePng(png(2,2,{chunks:[chunk(type,data)]}),false)).toThrow();
  });
  it.each(['sRGB','gAMA','pHYs'])('rejects duplicate, late, interrupted and corrupt %s chunks',type=>{
    const metadata=displayMetadata().find(b=>b.toString('ascii',4,8)===type)!;
    const base=png(), data=deflateSync(Buffer.alloc(18));
    const corrupt=Buffer.from(metadata); corrupt[corrupt.length-1]=corrupt[corrupt.length-1]!^1;
    const invalidFiles=[
      png(2,2,{chunks:[metadata,metadata]}),
      Buffer.concat([base.subarray(0,-12),metadata,base.subarray(-12)]),
      Buffer.concat([base.subarray(0,33),chunk('IDAT',data.subarray(0,2)),metadata,chunk('IDAT',data.subarray(2)),base.subarray(-12)]),
      Buffer.concat([base.subarray(0,8),metadata,base.subarray(8)]),
      png(2,2,{chunks:[corrupt]}),
      Buffer.concat([base,metadata]),
    ];
    for(const bytes of invalidFiles) expect(()=>validatePng(bytes,false)).toThrow();
  });
  it('rejects contradictory sRGB/gamma declarations in either order',()=>{
    const chunks=[chunk('sRGB',Buffer.from([0])),chunk('gAMA',uint32(100000))];
    for(const order of [chunks,[...chunks].reverse()]) expect(()=>validatePng(png(2,2,{chunks:order}),false)).toThrow();
  });
  it('keeps decompression and consecutive IDAT validation with display chunks',()=>{
    const base=png(2,2,{chunks:displayMetadata()}), compressed=deflateSync(Buffer.alloc(18));
    const idatOffset=33+displayMetadata().reduce((n,c)=>n+c.length,0);
    const split=Buffer.concat([base.subarray(0,idatOffset),chunk('IDAT',compressed.subarray(0,2)),chunk('IDAT',compressed.subarray(2)),base.subarray(-12)]);
    expect(validatePng(split,false).width).toBe(2);
    for(const options of [{raw:Buffer.alloc(100)},{raw:Buffer.alloc(10)},{filter:5},
      {compressed:Buffer.concat([compressed,Buffer.from('extra')])}]) {
      expect(()=>validatePng(png(2,2,{chunks:displayMetadata(),...options}),false)).toThrow();
    }
  });
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
