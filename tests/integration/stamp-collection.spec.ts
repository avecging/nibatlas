import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ISSUED_STAMP, STAMP_OWNER } from '../../src/test/stamp';

async function fixture(page:Page) {
  let collected=false;
  let signedIn=true;
  const actions:string[]=[];
  await page.route('**/api/v1/auth/session',route=>route.fulfill({json:signedIn
    ? {status:'signed-in',userId:STAMP_OWNER,identityLabel:'fixture@example.test',displayName:null}
    : {status:'signed-out'}}));
  await page.route('**/api/v1/auth/sign-out',route=>{signedIn=false;return route.fulfill({status:204});});
  await page.route('**/api/v1/saved-shops',route=>route.fulfill({json:{savedShopIds:[],shops:[]}}));
  await page.route('**/api/v1/saved-shops/pending',route=>route.fulfill({status:204}));
  await page.route('**/api/v1/collections*',route=>route.fulfill({json:{ownerId:STAMP_OWNER,collections:collected?[ISSUED_STAMP]:[],nextCursor:null}}));
  await page.route('**/api/v1/stamps/*',async route=>{
    const action=route.request().url().split('/').at(-1)!;actions.push(action);
    const body=route.request().postDataJSON() as Record<string,unknown>;
    expect(body['shopId']).toBe(ISSUED_STAMP.shopId);
    expect(body).not.toHaveProperty('userId');expect(body).not.toHaveProperty('timestamp');
    if(action==='nonce') return route.fulfill({json:collected
      ? {ok:true,status:'duplicate',collection:ISSUED_STAMP}
      : {ok:true,status:'nonce_issued',requestId:STAMP_OWNER,nonce:'a'.repeat(64)}});
    if(action==='verify') {
      expect(body['position']).toMatchObject({latitude:35.681236,longitude:139.767125,accuracy:100});
      return route.fulfill({json:{ok:true,status:'confirmation_required'}});
    }
    expect(body).toEqual({shopId:ISSUED_STAMP.shopId,requestId:STAMP_OWNER,nonce:'a'.repeat(64),confirmedAtShop:true});
    collected=true;
    return route.fulfill({json:{ok:true,status:'success',collection:ISSUED_STAMP,invalidate:['collections','visited-shops','passport']}});
  });
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({latitude:35.681236,longitude:139.767125,accuracy:100});
  return actions;
}

for(const width of [360,1440]) {
  test(`verified collection, Passport and visited map reconcile at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:width===360?800:900});
    if(width===360) await page.emulateMedia({reducedMotion:'reduce'});
    const actions=await fixture(page);
    await page.goto('/shops/m3-api-demo-shop');
    await page.getByRole('button',{name:'Collect Stamp',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Before you collect'});
    await expect(dialog).toBeVisible();expect(actions).toEqual([]);
    await expect(dialog.getByRole('button',{name:'I am at this shop'})).toHaveCount(0);
    await dialog.getByRole('button',{name:'Check my location'}).click();
    const confirm=page.getByRole('dialog',{name:'Confirm your visit'});
    await expect(confirm).toBeVisible();expect(actions).toEqual(['nonce','verify']);
    expect((await new AxeBuilder({page}).include('[aria-labelledby="verified-collect-title"]').analyze()).violations).toEqual([]);
    await testInfo.attach(`confirmation-${width}`,{body:await page.screenshot(),contentType:'image/png'});
    await confirm.getByRole('button',{name:'I am at this shop',exact:true}).click();
    const ceremony=page.getByTestId('stamp-ceremony');await expect(ceremony).toBeVisible();
    await expect(ceremony).toContainText('Historical Demo Shop');await expect(ceremony).toContainText('2026-09-12');
    await expect(ceremony.locator('[data-phase]')).toHaveAttribute('data-phase','settled');
    expect((await new AxeBuilder({page}).include('[data-testid="stamp-ceremony"]').analyze()).violations).toEqual([]);
    await testInfo.attach(`impression-${width}`,{body:await page.screenshot(),contentType:'image/png'});
    await ceremony.getByRole('link',{name:'Open in Passport'}).click();
    await expect(page).toHaveURL(/\/passport\/jp\/tokyo\?stamp=/);
    await expect(page.getByText('Historical Demo Shop').first()).toBeVisible();
    await page.reload();await expect(page.getByText('Historical Demo Shop').first()).toBeVisible();
    await testInfo.attach(`passport-${width}`,{body:await page.screenshot(),contentType:'image/png'});
    const stored=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));
    expect(stored).not.toContain('Historical Demo Shop');expect(stored).not.toContain('latitude');expect(stored).not.toContain('nonce');
    await page.goto('/');
    const dismiss=page.getByRole('button',{name:'Dismiss introduction'});if(await dismiss.isVisible().catch(()=>false))await dismiss.click();
    const marker=page.getByRole('button',{name:/^M3 API Demo Shop, Tokyo\./});
    await expect(marker).toHaveAccessibleName(/visited/i);
    await page.goto('/shops/m3-api-demo-shop');
    await page.getByRole('button',{name:'View Atlas Stamp'}).click();
    await expect(page.getByText('Already in your Passport')).toBeVisible();
    expect(actions).toEqual(['nonce','verify','collect']);
    await page.goto('/me');await page.getByRole('button',{name:'Sign out',exact:true}).click();
    await page.goto('/passport');await expect(page.getByText('Your private Passport')).toBeVisible();
    await expect(page.getByText('Historical Demo Shop')).toHaveCount(0);
  });
}

test('cancel and resume preflight never request a background fix',async({page})=>{
  const actions=await fixture(page);
  await page.goto('/shops/m3-api-demo-shop?collect=1');
  const dialog=page.getByRole('dialog',{name:'Before you collect'});
  await expect(dialog).toBeVisible();expect(actions).toEqual([]);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog).toHaveCount(0);expect(actions).toEqual([]);
  await expect(page).toHaveURL('/shops/m3-api-demo-shop');
});
