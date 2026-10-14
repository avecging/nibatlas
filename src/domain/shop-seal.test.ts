import { describe, expect, it } from 'vitest';
import { decodeShopTemplate, initialShopSeal, randomiseShopSeal, SHOP_SEAL_SHAPES } from './shop-seal';
import { STAMP_INKS } from './stamp-palette';

describe('versioned shop defaults', () => {
  it('preserves legacy templates and projects only known fields', () => {
    expect(decodeShopTemplate({tier:'shop',motif:'counter',privateKey:'omit'})).toEqual({tier:'shop',motif:'counter'});
    expect(decodeShopTemplate({tier:'shop',motif:'nib',template:'shop-seal-v1',shape:'oval',privateKey:'omit'}))
      .toEqual({tier:'shop',motif:'nib',template:'shop-seal-v1',shape:'oval'});
  });
  it.each([{template:'future',shape:'oval'},{shape:'oval'},{template:'shop-seal-v1'},
    {template:'shop-seal-v1',shape:'circle'},{template:null}])('rejects unknown/incomplete template %j', fields => {
    expect(()=>decodeShopTemplate({tier:'shop',motif:'nib',...fields})).toThrow();
  });
  it('pins initial choices to identity and distributes all three shapes', () => {
    expect(initialShopSeal('78000000-0000-4000-8000-000000000010')).toEqual(initialShopSeal('78000000-0000-4000-8000-000000000010'));
    expect(new Set(Array.from({length:100},(_,i)=>initialShopSeal(String(i)).shape)).size).toBe(3);
  });
  it('changes both choices at every click without changing the supplied saved choice', () => {
    for (const shape of SHOP_SEAL_SHAPES) for (const ink of STAMP_INKS) for (const random of [0,.5,.999999]) {
      const before={shape,ink}; const next=randomiseShopSeal(before,()=>random);
      expect(next.shape).not.toBe(shape); expect(next.ink).not.toBe(ink);
      expect(SHOP_SEAL_SHAPES).toContain(next.shape); expect(STAMP_INKS).toContain(next.ink);
      expect(before).toEqual({shape,ink});
    }
  });
});
