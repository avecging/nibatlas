import {readFileSync} from 'node:fs';
import {renderSealSvg} from '../../src/server/media/seal-artwork';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {stubSession} from '../support/auth';
const id='e1000000-0000-4000-8000-000000000001',locality='e1000000-0000-4000-8000-000000000002';
test('seal dashboard, separate editor, publication and version history',async({page},testInfo)=>{
 await stubSession(page,{kind:'signed-in'});
 await page.route('**/api/v1/admin/shops/options',r=>r.fulfill({json:{localities:[{id:locality,label:'Singapore',countryCode:'SG'}],types:[],services:[],specialties:[],brands:[]}}));
 let saved:Record<string,unknown>|null=null;const actions:string[]=[];const history:{version:number;snapshot:Record<string,unknown>}[]=[];
 await page.route('**/api/v1/admin/seals{,?*}',async r=>{
  const url=new URL(r.request().url());
  if(r.request().method()==='GET')return r.fulfill({json:url.searchParams.has('history')?{entries:history,nextBefore:null}:url.searchParams.has('id')?{seal:saved}:{entries:saved?[saved]:[],nextCursor:null}});
  const b=r.request().postDataJSON();actions.push(b.action);
  if(b.action==='save')saved={id,revision:id,draft:b.document,localityName:'Singapore',published:false,publishedVersion:null};
  else {saved={...saved,published:b.action==='publish',publishedVersion:1};if(b.action==='publish')history.push({version:1,snapshot:{...(saved.draft as Record<string,unknown>),localityName:'Singapore',localitySlug:'singapore',eligibleShops:[]}});}
  await r.fulfill({json:{seal:saved}});
 });
 await page.goto('/admin/seals');
 await expect(page.getByRole('columnheader',{name:'Scope'})).toBeVisible();
 await expect(page.getByRole('status')).toHaveText('0 seals on this page');
 await page.getByRole('link',{name:'Add new seal'}).click();
 await expect(page.getByRole('heading',{name:'Add new seal',exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Scope',exact:true}).selectOption('locality');
 await page.getByRole('combobox',{name:'Locality',exact:true}).selectOption(locality);
 await expect(page.getByRole('img',{name:'Locality seal, Singapore, verified visits'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Publish saved seal'})).toBeDisabled();
 await page.getByRole('button',{name:'Save privately',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/admin/seals/${id}$`));
 expect(actions).toEqual(['save']);await page.getByRole('button',{name:'Publish saved seal'}).click();
 await expect(page.getByRole('status')).toHaveText('Published. Past verified visits count too.');
 await page.getByRole('combobox',{name:'Ink',exact:true}).selectOption('navy');await expect(page.getByRole('button',{name:'Publish saved seal'})).toBeDisabled();
 await page.getByRole('button',{name:'Discard unsaved changes'}).click();
 await page.getByRole('tab',{name:'Version history'}).click();await expect(page.getByRole('heading',{name:'Version 1 · Current'})).toBeVisible();
 await expect(page.getByText('Generated default',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Design & details'}).click();await page.getByRole('button',{name:'Unpublish',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Unpublished. Existing collectors keep their seals.');
 expect(actions).toEqual(['save','publish','unpublish']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('admin-geographic-seal.png'),fullPage:true});
 await page.getByRole('link',{name:'← All stamps & seals'}).click();await expect(page.getByRole('link',{name:'Edit Singapore locality seal'})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('admin-seal-dashboard.png'),fullPage:true});
});

// Real founder-supplied path artwork: assert rendered pixels, not only CSS or URL changes.
test('uploaded SVG follows selected ink while preserving transparent background',async({page})=>{
 await stubSession(page,{kind:'signed-in'});
 const source=readFileSync('tests/fixtures/seal-monochrome.svg');
 await page.route('**/api/v1/admin/shops/options',r=>r.fulfill({json:{localities:[],types:[],services:[],specialties:[],brands:[]}}));
 await page.route('**/api/v1/admin/seals?id=*',r=>r.fulfill({json:{seal:{id,revision:id,draft:{scope:'country',countryCode:'SG',countryLabel:'Singapore',localityId:null,eligibleShopIds:[],name:'Logo test',origin:'founder_created',ink:'teal',artworkId:locality,artworkTreatment:'ink-v1'},published:false,publishedVersion:null}}}));
 await page.route('**/api/v1/seals/artwork/*',r=>r.fulfill({contentType:'image/svg+xml',headers:{'Content-Security-Policy':"default-src 'none'; style-src 'none'; sandbox"},body:renderSealSvg(source,new URL(r.request().url()).searchParams.get('ink') as 'teal'|'plum')}));
 await page.goto(`/admin/seals/${id}`);await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Logo test');
 const art=page.getByRole('img',{name:'Country seal, Logo test'});
 async function pixels(){return art.evaluate(async node=>{const img=node as HTMLImageElement;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let transparent=0,opaque=0;const colours=new Set<string>();for(let i=0;i<data.length;i+=4){if(data[i+3]===0)transparent++;if(data[i+3]===255){opaque++;colours.add(`${data[i]},${data[i+1]},${data[i+2]}`);}}return {transparent,opaque,colours:[...colours]};});}
 const teal=await pixels();expect(teal.colours).toEqual(['40,122,120']);expect(teal.transparent).toBeGreaterThan(1000);expect(teal.opaque).toBeGreaterThan(1000);
 await page.getByRole('combobox',{name:'Ink',exact:true}).selectOption('plum');await expect(art).toHaveAttribute('src',`/api/v1/seals/artwork/${locality}?ink=plum`);
 const plum=await pixels();expect(plum.colours).toEqual(['107,63,99']);expect(plum.transparent).toBe(teal.transparent);expect(plum.opaque).toBe(teal.opaque);
});
