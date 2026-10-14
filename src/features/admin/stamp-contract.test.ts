import { describe, expect, it } from 'vitest';
import { decodeAdminStamps } from './stamp-contract';
const generated={id:'78000000-0000-4000-8000-000000000001',stampId:'78000000-0000-4000-8000-000000000002',designVersion:1,
  kind:'generated_template',origin:'generated_template',status:'approved',ink:'teal',creatorName:null,creatorUrl:null,
  templateData:{tier:'shop',motif:'nib'},hasArtwork:false,active:true,revision:'a'.repeat(32)};
describe('private generated stamp projection',()=>{
  it('uses the stored motif; supports older responses without inventing one',()=>{
    expect(decodeAdminStamps([generated])[0]?.templateData).toEqual({tier:'shop',motif:'nib'});
    const old={...generated,templateData:undefined};
    expect(decodeAdminStamps([old])[0]?.templateData).toBeUndefined();
  });
  it.each([{tier:'country',motif:'nib'},{tier:'shop',motif:'invented'},[],true])('rejects an unsupported template %j',templateData=>{
    expect(()=>decodeAdminStamps([{...generated,templateData}])).toThrow();
  });
  it('does not substitute generated art for uploaded artwork',()=>{
    expect(()=>decodeAdminStamps([{...generated,kind:'uploaded',origin:'ai_assisted'}])).toThrow();
  });
});

it.each(['https://','https://example.test/a b'])('reads retained historical creator link %s without stranding the list',creatorUrl=>{
  expect(decodeAdminStamps([{...generated,templateData:null,kind:'uploaded',origin:'founder_created',creatorName:'Original creator',creatorUrl}])[0]?.creatorUrl).toBe(creatorUrl);
});
