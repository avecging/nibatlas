import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { crc32, InvalidMedia, MAX_MEDIA_BYTES, readBounded, validatePng } from './png';

export const MAX_JPEG_PIXELS = 24_000_000;
export const MAX_JPEG_AXIS = 8192;
export const PHOTO_AXIS = 1024;
const invalid = (): never => { throw new InvalidMedia('Unsupported or invalid JPEG'); };
export const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Read only IFD0 orientation. Never follow GPS, thumbnail or arbitrary IFD pointers.
function exifOrientation(b: Buffer): number {
  const t=b.subarray(6);
  if (t.length<8) return invalid();
  const le=t.toString('ascii',0,2)==='II';
  if (!le && t.toString('ascii',0,2)!=='MM') return invalid();
  const u16=(at:number) => { if(at<0 || at+2>t.length) return invalid(); return le?t.readUInt16LE(at):t.readUInt16BE(at); };
  const u32=(at:number) => { if(at<0 || at+4>t.length) return invalid(); return le?t.readUInt32LE(at):t.readUInt32BE(at); };
  if(u16(2)!==42) return invalid();
  const at=u32(4), n=u16(at);
  if(at<8 || n>1024 || at+2+n*12+4>t.length) return invalid();
  let orientation=1, found=false;
  for(let i=0;i<n;i++) {
    const p=at+2+i*12;
    if(u16(p)!==0x112) continue;
    if(found || u16(p+2)!==3 || u32(p+4)!==1) return invalid();
    orientation=u16(p+8); found=true;
    if(orientation<1 || orientation>8) return invalid();
  }
  return orientation;
}

/** Structural/resource preflight, not a substitute for the Images decoder.
 * Remove APP/COM metadata before sending pixels to the decoder, retaining
 * orientation only in memory, bounded ICC chunks and canonical Adobe colour
 * interpretation for decoding. Accept 8-bit baseline/progressive, three components.
 */
export function inspectJpeg(bytes: Uint8Array) {
  const b=Buffer.from(bytes);
  if(b.length<4 || b.length>MAX_MEDIA_BYTES || b.readUInt16BE(0)!==0xffd8) return invalid();
  const parts=[b.subarray(0,2)];
  let p=2,width=0,height=0,orientation=1,exif=false,adobe=false,scans=0,markers=0,iccCount=0;
  const iccSeen=new Set<number>();
  while(p<b.length) {
    if(++markers>4096 || b[p]!==255) return invalid();
    const start=p++;
    while(b[p]===255) p++;
    const marker=b[p++];
    if(marker===0xd9) {
      if(!width || !scans || p!==b.length || iccSeen.size!==iccCount) return invalid();
      parts.push(Buffer.from([255,217]));
      return {width,height,orientation,bytes:Buffer.concat(parts)};
    }
    if(marker===undefined || ![0xc0,0xc2,0xc4,0xdb,0xdd,0xda,0xfe,...Array.from({length:16},(_,i)=>0xe0+i)].includes(marker) || p+2>b.length) return invalid();
    const size=b.readUInt16BE(p), end=p+size;
    if(size<2 || end>b.length) return invalid();
    const payload=b.subarray(p+2,end);
    if(marker===0xc0 || marker===0xc2) {
      if(width || payload.length!==15 || payload[0]!==8 || payload[5]!==3) return invalid();
      height=payload.readUInt16BE(1); width=payload.readUInt16BE(3);
      if(!width || !height || width>MAX_JPEG_AXIS || height>MAX_JPEG_AXIS || width*height>MAX_JPEG_PIXELS) return invalid();
    }
    const metadata=marker>=0xe0 || marker===0xfe;
    if(marker===0xe1 && payload.subarray(0,6).equals(Buffer.from('Exif\0\0'))) {
      if(exif) return invalid();
      orientation=exifOrientation(payload); exif=true;
    }
    // Preserve ICC only for decoder colour conversion, never in the stored PNG.
    const icc=marker===0xe2 && payload.subarray(0,12).toString()==='ICC_PROFILE\0';
    if(icc) {
      const seq=payload[12]!, count=payload[13]!;
      if(payload.length<15 || !seq || !count || seq>count || (iccCount && iccCount!==count) || iccSeen.has(seq)) return invalid();
      iccCount=count;iccSeen.add(seq);
    }
    if(marker===0xe2 && payload.subarray(0,4).toString()==='MPF\0') return invalid();
    if(marker===0xee && payload.subarray(0,5).toString()==='Adobe') {
      if(adobe || scans>0 || payload.length!==12 || (payload[11]!==0 && payload[11]!==1)) return invalid();
      adobe=true;
      // Transform 0 means RGB for the required three-component frame; transform
      // 1 means YCbCr. Stripping this would misdecode numeric-ID RGB components.
      // Keep only a canonical decoder hint; discard original version/flags.
      parts.push(Buffer.from([255,238,0,14,65,100,111,98,101,0,100,0,0,0,0,payload[11]]));
    }
    if(!metadata || icc) parts.push(b.subarray(start,end));
    p=end;
    if(marker===0xda) {
      if(!width || ++scans>128 || payload.length<6) return invalid();
      const entropy=p;
      while(p<b.length) {
        if(b[p++]!==255) continue;
        const m=b[p];
        if(m===0 || (m!==undefined && m>=0xd0 && m<=0xd7)) {p++;continue;}
        p--;break;
      }
      if(p===entropy || p>=b.length) return invalid();
      parts.push(b.subarray(entropy,p));
    }
  }
  return invalid();
}

export interface PhotoImages {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options:{width:number;height?:never} | {height:number;width?:never}): {
      output(options:{format:'image/png'}): Promise<{response():Response}>;
    };
  };
}
function chunk(type:string,data:Buffer) {
  const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);
  b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;
}
// Apply all eight EXIF transforms ourselves to decoded pixels. Local Images
// emulation doesn't promise auto-orientation; stripped input prevents double rotation.
export function orientPhoto(pixels:Uint8Array,width:number,height:number,orientation:number) {
  const swap=orientation>=5, w=swap?height:width,h=swap?width:height;
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    let dx=x,dy=y;
    switch(orientation) {
      case 2: dx=width-1-x;break;
      case 3: dx=width-1-x;dy=height-1-y;break;
      case 4: dy=height-1-y;break;
      case 5: dx=y;dy=x;break;
      case 6: dx=height-1-y;dy=x;break;
      case 7: dx=height-1-y;dy=width-1-x;break;
      case 8: dx=y;dy=width-1-x;break;
    }
    raw.set(pixels.subarray((y*width+x)*4,(y*width+x+1)*4),dy!*(w*4+1)+1+dx!*4);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
export async function processJpeg(bytes:Uint8Array,images:PhotoImages) {
  const input=inspectJpeg(bytes);
  const landscape=input.width>=input.height;
  const sourceLong=landscape?input.width:input.height, sourceShort=landscape?input.height:input.width;
  const targetLong=Math.min(PHOTO_AXIS,sourceLong), targetShort=sourceShort*targetLong/sourceLong;
  // Only the long axis constrains the decoder. Two rounded bounds can make the
  // short axis limiting and unexpectedly shrink the requested long axis again.
  const response=(await images.input(new ReadableStream({start(c){c.enqueue(input.bytes);c.close();}}))
    .transform(landscape?{width:targetLong}:{height:targetLong}).output({format:'image/png'})).response();
  if(!response.ok || response.headers.get('content-type')!=='image/png') return invalid();
  const decoded=await readBounded(response.body,MAX_MEDIA_BYTES);
  const checked=validatePng(decoded,false);
  const {width,height}=checked, actualLong=landscape?width:height, actualShort=landscape?height:width;
  // Allow the decoder's whole-pixel rounding, while independently enforcing the
  // intended scale/aspect ratio and the 1024-axis/no-upscale allocation budget.
  if(actualLong!==targetLong || actualShort<Math.max(1,Math.floor(targetShort)) ||
      actualShort>Math.ceil(targetShort) || width>input.width || height>input.height ||
      width>PHOTO_AXIS || height>PHOTO_AXIS) return invalid();
  const pixels=new Uint8Array(width*height*4);
  validatePng(decoded,false,pixels);
  const output=orientPhoto(pixels,width,height,input.orientation);
  return {bytes:output,checked:validatePng(output,false)};
}
