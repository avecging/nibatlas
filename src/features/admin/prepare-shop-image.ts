import { imageContentType } from './image-content-type';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_AXIS = 8192;
const MAX_PIXELS = 24_000_000;
const LOGO_AXIS = 1024;

function boundedDimensions(width: number, height: number) {
  if (!width || !height || width > MAX_AXIS || height > MAX_AXIS || width * height > MAX_PIXELS) {
    throw new Error('Choose a logo up to 8192 px per side and 24 megapixels.');
  }
}

/** Photos keep their existing transport; JPEG logos use the server's processor.
 * PNG logos are normalized before their immutable upload identity is created.
 * This helper is never used for stamp artwork. */
export async function prepareShopImage(file: File, logo: boolean) {
  if (!file.size || file.size > MAX_BYTES) throw new Error('Choose a PNG or JPEG up to 5 MiB.');
  const bytes = await file.arrayBuffer();
  const contentType = imageContentType(new Uint8Array(bytes));
  if (!contentType) throw new Error('This file is not a PNG or JPEG image. Choose another file.');
  if (!logo || contentType === 'image/jpeg') return { bytes, contentType };

  // Bound the original PNG before asking the browser to allocate decoded pixels.
  const view = new DataView(bytes);
  if (bytes.byteLength < 33 || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) {
    throw new Error('This PNG could not be read. Choose another image.');
  }
  boundedDimensions(view.getUint32(16), view.getUint32(20));
  // Logos are static images; never silently select a frame from an animated PNG.
  for (let at = 8, chunks = 0; at < bytes.byteLength;) {
    if (++chunks > 1024 || at + 12 > bytes.byteLength) throw new Error('This PNG could not be read.');
    const length = view.getUint32(at), end = at + 12 + length;
    if (end > bytes.byteLength || view.getUint32(at + 4) === 0x6163544c) {
      throw new Error('Choose a static PNG or JPEG logo.');
    }
    at = end;
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' })); }
  catch { throw new Error('This PNG could not be decoded. Choose another image.'); }
  try {
    boundedDimensions(bitmap.width, bitmap.height);
    const scale = Math.min(1, LOGO_AXIS / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this logo. Try again in a supported browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png || !png.size || png.size > MAX_BYTES) throw new Error('Could not prepare this logo within the 5 MiB limit.');
    return { bytes: await png.arrayBuffer(), contentType: 'image/png' as const };
  } finally { bitmap.close(); }
}
