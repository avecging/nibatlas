import { describe, expect, it, vi } from 'vitest';
import { sealDocument, sealSnapshot, sealDesign, sealWire } from './geographic-seals';
import { DEFAULT_COUNTRY_INKS, randomCountryInk } from './seal-template';

const id = 'e1000000-0000-4000-8000-000000000001';
const old = {scope:'country', countryCode:'SG', countryLabel:'Singapore', localityId:null,
  ink:'teal', eligibleShopIds:[], eligibleShops:[], localitySlug:null, localityName:null, template:'cartouche-v1'};

describe('versioned geographic artwork', () => {
  it('keeps the original award when the current definition uses the new template', () => {
    const wire = sealWire({id, published:true, current:{...old, template:'cartouche-v2', ink:'plum'},
      progress:{count:5,collectedIds:[]}, award:{id,sealId:id,version:1,snapshot:old,
        earnedOn:'2026-10-02',shopId:id,unseen:false}});
    expect(wire.current?.template).toBe('cartouche-v2');
    expect(wire.award?.snapshot).toMatchObject({template:'cartouche-v1',ink:'teal'});
    expect(sealDesign(id, wire.award!.snapshot).generatedSealTemplate).toBe('cartouche-v1');
  });
  it('retains the selected template through save and history decoding for both scopes', () => {
    const doc = sealDocument({...old,template:'cartouche-v2'});
    expect(doc.template).toBe('cartouche-v2');
    expect(sealDesign(id,doc).generatedSealTemplate).toBe('cartouche-v2');
    expect(sealSnapshot({...old,scope:'locality',localityId:id,localitySlug:'singapore',localityName:'Singapore',template:'cartouche-v2'}).template).toBe('cartouche-v2');
    const legacy = {...old, template: undefined};
    expect(sealDesign(id,sealDocument(legacy)).generatedSealTemplate).toBe('cartouche-v1');
  });
  it.each(['unknown',null,42])('rejects an unsupported template %s', template => {
    expect(() => sealDocument({...old,template})).toThrow('Invalid seal template');
  });
  it('uses only the six requested starting inks across the whole random range', () => {
    const random = vi.spyOn(Math,'random');
    try {
      const actual = Array.from({length:6},(_,i)=>{random.mockReturnValue((i + 0.5) / 6);return randomCountryInk();});
      expect(actual).toEqual([...DEFAULT_COUNTRY_INKS]);
    } finally { random.mockRestore(); }
  });
});
