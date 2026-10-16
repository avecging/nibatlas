/** Remove ancillary export metadata without decoding or recompressing image pixels.
 * The strict server PNG validator still checks the resulting structure and pixels.
 */
export function preparePngUpload(input: Uint8Array): Uint8Array {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (input.length < 57 || signature.some((byte, i) => input[i] !== byte)) throw Error('Invalid PNG');
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const kept: Uint8Array[] = [input.subarray(0, 8)];
  let offset = 8, chunks = 0, changed = false, ended = false;
  while (offset < input.length) {
    if (++chunks > 1024 || offset + 12 > input.length) throw Error('Invalid PNG');
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > input.length) throw Error('Invalid PNG');
    const type = String.fromCharCode(...input.subarray(offset + 4, offset + 8));
    if (chunks === 1 && type !== 'IHDR') throw Error('Invalid PNG');
    // APNG is deliberately unsupported; dropping animation control chunks would
    // silently turn the export into a different piece of artwork.
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') throw Error('Animated PNG is unsupported');
    // RGB PNGs can encode transparency outside IDAT. Reject the unsupported
    // form so metadata cleanup cannot turn transparent pixels opaque.
    if (type === 'tRNS') throw Error('PNG transparency format is unsupported');
    if (type === 'IEND') {
      if (end !== input.length) throw Error('Invalid PNG');
      ended = true;
    }
    // Keep pixel-bearing chunks and colour information, including wide-gamut
    // ICC profiles. Drop EXIF, text, timestamps and other ancillary metadata.
    // Unknown critical chunks remain for the server validator to reject.
    if (type === 'IHDR' || type === 'IDAT' || type === 'IEND' ||
        type === 'sRGB' || type === 'gAMA' || type === 'pHYs' ||
        type === 'iCCP' || type === 'cICP' || type === 'cHRM' ||
        (input[offset + 4]! & 0x20) === 0) kept.push(input.subarray(offset, end));
    else changed = true;
    offset = end;
  }
  if (!ended) throw Error('Invalid PNG');
  if (!changed) return input;
  const output = new Uint8Array(kept.reduce((size, part) => size + part.length, 0));
  let at = 0;
  for (const part of kept) { output.set(part, at); at += part.length; }
  return output;
}
