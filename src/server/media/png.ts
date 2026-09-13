import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export class InvalidMedia extends Error {}
function invalid(): never { throw new InvalidMedia('Unsupported or invalid PNG'); }

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Strict subset: RGB/RGBA 8-bit, non-interlaced, no metadata or animation.
 * Reject unsupported exports unchanged; never rewrite a commissioned file.
 */
export function validatePng(bytes: Uint8Array, artwork: boolean) {
  if (bytes.length > MAX_MEDIA_BYTES || bytes.length < 57) invalid();
  const b = Buffer.from(bytes);
  if (!b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) invalid();
  let offset = 8, width = 0, height = 0, channels = 0, ended = false, chunkCount = 0;
  const parts: Buffer[] = [];
  while (offset < b.length) {
    if (++chunkCount > 1024 || offset + 12 > b.length) invalid();
    const size = b.readUInt32BE(offset), end = offset + 12 + size;
    if (end > b.length) invalid();
    const type = b.toString('latin1', offset + 4, offset + 8);
    if (crc32(b.subarray(offset + 4, end - 4)) !== b.readUInt32BE(end - 4)) invalid();
    if (offset === 8) {
      if (type !== 'IHDR' || size !== 13) invalid();
      width = b.readUInt32BE(offset + 8); height = b.readUInt32BE(offset + 12);
      const depth = b[offset + 16], colour = b[offset + 17]!;
      if (width < 1 || height < 1 || width > 2048 || height > 2048 || depth !== 8 ||
          ![2,6].includes(colour) || b[offset+18] || b[offset+19] || b[offset+20]) invalid();
      channels = colour === 6 ? 4 : 3;
      if (artwork && (width !== 1200 || height !== 800 || channels !== 4)) invalid();
    } else if (type === 'IDAT' && size > 0 && !ended) {
      parts.push(b.subarray(offset + 8, end - 4));
    } else if (type === 'IEND' && size === 0 && parts.length && end === b.length) {
      ended = true;
    } else invalid(); // Includes EXIF/GPS, text, ICC, scripts, APNG and unknown chunks.
    offset = end;
  }
  if (!ended) invalid();
  const stride = width * channels, expected = (stride + 1) * height;
  const compressed = Buffer.concat(parts);
  let raw: Buffer;
  try {
    const inflated = inflateSync(compressed, { maxOutputLength: expected, info: true }) as unknown as
      { buffer: Buffer; engine: { bytesWritten: number } };
    raw = inflated.buffer;
    if (inflated.engine.bytesWritten !== compressed.length || raw.length !== expected) invalid();
  } catch { return invalid(); }
  let transparent = false;
  let previous = new Uint8Array(stride);
  for (let y=0; y<height; y++) {
    const start = y*(stride+1), filter = raw[start]!;
    if (filter > 4) invalid();
    const row = new Uint8Array(stride);
    for (let x=0; x<stride; x++) {
      const left = x>=channels ? row[x-channels]! : 0, up = previous[x]!, corner = x>=channels ? previous[x-channels]! : 0;
      let predictor = 0;
      if (filter===1) predictor=left;
      if (filter===2) predictor=up;
      if (filter===3) predictor=Math.floor((left+up)/2);
      if (filter===4) {
        const p=left+up-corner, pa=Math.abs(p-left), pb=Math.abs(p-up), pc=Math.abs(p-corner);
        predictor=pa<=pb && pa<=pc ? left : pb<=pc ? up : corner;
      }
      row[x]=(raw[start+1+x]!+predictor)&255;
      if (channels===4 && x%4===3 && row[x]===0) transparent=true;
    }
    previous=row;
  }
  if (artwork && !transparent) invalid();
  return { width, height, byteSize: b.length, sha256: createHash('sha256').update(b).digest('hex') };
}

export async function readBounded(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) invalid();
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size=0;
  try {
    for (;;) {
      const next=await reader.read();
      if (next.done) break;
      size+=next.value.byteLength;
      if (size>limit) { await reader.cancel(); invalid(); }
      parts.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const result=new Uint8Array(size);
  let at=0;
  for (const part of parts) { result.set(part,at); at+=part.length; }
  return result;
}
