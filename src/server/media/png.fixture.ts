import { deflateSync } from 'node:zlib';
import { crc32 } from './png';
export function chunk(type: string, data: Buffer) {
  const head=Buffer.alloc(4); head.writeUInt32BE(data.length);
  const value=Buffer.concat([Buffer.from(type),data]);
  const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(value));
  return Buffer.concat([head,value,crc]);
}
export function png(width=2,height=2,options: { opaque?: boolean; filter?: number; metadata?: string; raw?: Buffer; compressed?: Buffer }={}) {
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height,4); ihdr[8]=8; ihdr[9]=6;
  const raw=options.raw ?? Buffer.alloc((width*4+1)*height,options.opaque ? 255 : 0);
  for (let y=0;y<height;y++) raw[y*(width*4+1)]=options.filter ?? 0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),
    ...(options.metadata ? [chunk(options.metadata,Buffer.from('private data'))] : []),
    chunk('IDAT',options.compressed ?? deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
