import { describe, expect, it } from 'vitest';
import { imageContentType } from './image-content-type';
import { png } from '@/src/server/media/png.fixture';
import { jpeg } from '@/src/server/media/jpeg.fixture';

describe('shop image format routing', () => {
  it('recognizes actual PNG/JPEG contents without filename or browser MIME', () => {
    expect(imageContentType(png())).toBe('image/png');
    expect(imageContentType(jpeg)).toBe('image/jpeg');
  });
  it('rejects unknown and truncated signatures', () => {
    for (const bytes of [Buffer.from('<svg/>'), Buffer.from('RIFFwebp'), new Uint8Array(), jpeg.subarray(0,2), png().subarray(0,7)]) {
      expect(imageContentType(bytes)).toBeNull();
    }
  });
});
