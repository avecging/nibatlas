// @vitest-environment node
import {expect,it} from 'vitest';
import {chunk,png} from '@/src/server/media/png.fixture';
import {validatePng} from '@/src/server/media/png';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {preparePngUpload} from './png-upload';

it('accepts common export metadata while preserving every decoded pixel and IDAT byte',()=>{
  const profile=Buffer.alloc(128);profile.writeUInt32BE(128);profile.write('acsp',36);
  const colour=chunk('iCCP',Buffer.concat([Buffer.from('Display P3\0\0'),deflateSync(profile)]));
  const original=png(1200,800,{chunks:[
    colour,
    chunk('cICP',Buffer.from([1,13,0,1])),
    chunk('eXIf',Buffer.from('private location')),
    chunk('pHYs',Buffer.from([0,0,14,196,0,0,14,196,1])),
    chunk('iTXt',Buffer.from('private caption')),
  ]});
  const cleaned=preparePngUpload(original);
  const pixelCount=1200*800*4;
  const pixels=new Uint8Array(pixelCount);
  const expected=new Uint8Array(pixelCount);
  validatePng(cleaned,true,pixels);
  validatePng(png(1200,800,{chunks:[chunk('pHYs',Buffer.from([0,0,14,196,0,0,14,196,1]))]}),true,expected);
  expect(createHash('sha256').update(pixels).digest('hex')).toBe(createHash('sha256').update(expected).digest('hex'));
  expect(cleaned.length).toBeLessThan(original.length);
  expect(Buffer.from(cleaned).includes(Buffer.from('private location'))).toBe(false);
  expect(Buffer.from(cleaned).includes(Buffer.from('private caption'))).toBe(false);
  expect(Buffer.from(cleaned).includes(colour)).toBe(true);
  expect(Buffer.from(cleaned).subarray(-12)).toEqual(original.subarray(-12));
});

it('keeps supported PNGs byte-for-byte and refuses to flatten animation',()=>{
  const plain=png();
  expect(preparePngUpload(plain)).toBe(plain);
  expect(()=>preparePngUpload(png(2,2,{metadata:'acTL'}))).toThrow('Animated PNG');
  const rgbHeader=Buffer.alloc(13);
  rgbHeader.writeUInt32BE(2);rgbHeader.writeUInt32BE(2,4);rgbHeader[8]=8;rgbHeader[9]=2;
  const transparentRgb=Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',rgbHeader),
    chunk('tRNS',Buffer.from([0,0,0,0,0,0])),
    chunk('IDAT',deflateSync(Buffer.alloc(14))),chunk('IEND',Buffer.alloc(0)),
  ]);
  expect(()=>preparePngUpload(transparentRgb)).toThrow('transparency format');
});
