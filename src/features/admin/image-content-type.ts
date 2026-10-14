/** Routing hint only. The server independently validates the complete image. */
export function imageContentType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  return null;
}
