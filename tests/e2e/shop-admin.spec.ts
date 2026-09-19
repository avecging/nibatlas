import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { stubSession } from "../support/auth";
import { png as makePng } from "../../src/server/media/png.fixture";
import {
  document,
  type ShopRecord,
} from "../../src/features/admin/shop-contract";
const id = "61000000-0000-4000-8000-000000000001",
  source = "61000000-0000-4000-8000-000000000002",
  locality = "61000000-0000-4000-8000-000000000003",
  type = "61000000-0000-4000-8000-000000000004";
function fixture(): ShopRecord {
  return {
    id,
    revision: "a".repeat(32),
    publicationStatus: "draft",
    hasChanges: false,
    publicationErrors: [],
    document: document({
      shop: {
        name: "M6 Demo shop",
        slug: "m6-demo-shop",
        source_quality: "demo",
        operational_status: "unknown",
        position_precision: "street",
        country_code: "SG",
        locality_id: locality,
        timezone: "Asia/Singapore",
        latitude: 1.3,
        longitude: 103.8,
        postal_code: "012345",
        last_verified_at: "2026-09-01T00:00:00Z",
        phone: "+65 0000 0000",
      },
      sources: [
        {
          id: source,
          label: "Explicit demo source",
          source_type: "demo_fixture",
          checked_at: "2026-09-01T00:00:00Z",
          reliability: "unknown",
          status: "active",
          claims: ["Name"],
          evidence_note: "Private internal note",
        },
      ],
      types: [{ shop_type_id: type, is_primary: true, source_id: source }],
      aliases: [],
      links: [],
      services: [],
      specialties: [],
      brands: [],
    }),
  };
}
async function setup(page: Page) {
  await stubSession(page, { kind: "signed-in" });
  let record = fixture();
  let oldDocument = structuredClone(record.document);
  const actions: string[] = [];
  let conflict = false;
  await page.route("**/api/v1/admin/shops**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown,
      status = 200;
    if (url.pathname.endsWith("/media") || url.pathname.endsWith("/stamp")) body = {entries: []};
    else if (url.pathname.endsWith("/options"))
      body = {
        localities: [
          { id: locality, label: "Singapore (SG)", countryCode: "SG" },
        ],
        types: [{ id: type, label: "Fountain Pen Specialist" }],
        services: [],
        specialties: [],
        brands: [],
      };
    else if (route.request().method() === "POST") {
      const request = route.request().postDataJSON();
      actions.push(request.action);
      if (conflict) {
        status = 409;
        body = { error: { code: "revision_conflict" } };
      } else {
        if (request.action === "create") {
          record = {
            ...fixture(),
            id: request.id,
            document: document({
              ...fixture().document,
              shop: { ...fixture().document.shop, ...request.document },
            }),
          };
        }
        if (request.action === "save") {
          record.document = request.document;
          record.hasChanges = true;
        }
        if (request.action === "publish") {
          record.publicationStatus = "published";
          record.hasChanges = false;
          oldDocument = structuredClone(record.document);
        }
        if (request.action === "discard") {
          record.document = oldDocument;
          record.hasChanges = false;
        }
        if (request.action === "archive") record.publicationStatus = "archived";
        if (
          [
            "temporarily_closed",
            "permanently_closed",
            "open",
            "unknown",
          ].includes(request.action)
        )
          record.document.shop.operational_status = request.action;
        record.revision =
          record.revision === "b".repeat(32) ? "c".repeat(32) : "b".repeat(32);
        body = record;
      }
    } else if (url.pathname.endsWith("/shops"))
      body = {
        entries: [
          {
            id: record.id,
            name: record.document.shop.name,
            slug: record.document.shop.slug,
            publicationStatus: record.publicationStatus,
            operationalStatus: record.document.shop.operational_status,
            hasChanges: record.hasChanges,
          },
        ],
        nextCursor: null,
      };
    else body = record;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  return {
    actions,
    conflict: () => {
      conflict = true;
    },
  };
}
test("founder edits, previews, publishes, closes and archives @short", async ({
  page,
}, info) => {
  const state = await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByLabel("Shop name")).toHaveValue("M6 Demo shop");
  await page.getByLabel("Shop name").fill("M6 Revised demo shop");
  await expect(
    page.getByRole("button", { name: "Preview saved version", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save changes privately" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Changes saved privately",
  );
  await page
    .getByRole("button", { name: "Preview saved version", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "M6 Revised demo shop" }),
  ).toBeVisible();
  await expect(page.getByText("Private internal note")).toHaveCount(0);
  await expect(page.getByText("012345", { exact: true })).toHaveCount(0);
  await expect(page.getByText("+65 0000 0000", { exact: true })).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath(`admin-preview-${info.project.name}.png`),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Publish saved version", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm publish", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Shop published.",
  );
  for (const action of ["temporarily closed", "open", "permanently closed"]) {
    await page
      .getByRole("button", { name: `Mark ${action}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `Confirm ${action}`, exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Operational status updated",
    );
  }
  await page.getByRole("button", { name: "Archive shop", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm archive", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Shop archived",
  );
  await expect(page.getByLabel("Shop name")).toBeDisabled();
  expect(state.actions).toEqual([
    "save",
    "publish",
    "temporarily_closed",
    "open",
    "permanently_closed",
    "archive",
  ]);
});
test("draft editor is accessible and preserves unknown information @short", async ({
  page,
}, info) => {
  await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByLabel("Shop name")).toBeVisible();
  await expect(page.getByLabel("Appointment required")).toHaveValue("");
  for (const label of ["Sources (1)", "Shop types (1)", "Opening hours"])
    await page.getByText(label, { exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const sizes = await page.evaluate(() => ({
    width: globalThis.document.documentElement.clientWidth,
    scroll: globalThis.document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
  for (const control of await page
    .locator(
      "main button:visible,main input:visible,main select:visible,main summary:visible",
    )
    .all()) {
    const b = await control.boundingBox();
    expect(b?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByLabel("Shop name").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("URL name")).toBeFocused();
  await page.screenshot({
    path: info.outputPath(`admin-editor-${info.project.name}.png`),
    fullPage: true,
  });
});
test("create flow and revision conflict preserve the unsaved work", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/admin/shops");
  await page.getByText("Create a draft shop", { exact: true }).click();
  await page.getByLabel("Shop name").fill("Another demo");
  await page.getByLabel("URL name").fill("another-demo");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  // The create form contains the same name field while navigation is pending.
  // Wait for the editor before making another edit, rather than matching that form.
  await expect(page).toHaveURL(/\/admin\/shops\/[a-f0-9-]{36}$/);
  await expect(page.getByRole("group", { name: "Catalogue details", exact: true })).toBeVisible();
  await expect(page.getByLabel("Shop name")).toHaveValue("Another demo");
  state.conflict();
  await page.getByLabel("Shop name").fill("Uncommitted demo");
  await page.getByRole("button", { name: "Save changes privately" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "changed in another session",
  );
  await expect(page.getByLabel("Shop name")).toHaveValue("Uncommitted demo");
});
test("denied and signed-out visitors see no editor data", async ({ page }) => {
  await stubSession(page, { kind: "signed-in" });
  await page.route("**/api/v1/admin/shops**", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "forbidden" } }),
    }),
  );
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "does not have catalogue access",
  );
  await expect(page.getByLabel("Shop name")).toHaveCount(0);
  await stubSession(page, { kind: "signed-out" });
  await page.reload();
  await expect(
    page.getByText(
      "Sign in with your founder or editor account, then return here.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Shop name")).toHaveCount(0);
});

test("editor supports zoom and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByLabel("Shop name")).toBeVisible();
  await page.evaluate(() => {
    globalThis.document.body.style.zoom = "2";
  });
  await page.getByLabel("Shop name").fill("Zoomed demo edit");
  await page.getByRole("button", { name: "Save changes privately" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Changes saved privately",
  );
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.document.documentElement.clientWidth,
    ),
  ).toBe(true);
});


test("dirty edits survive global links and browser Back @short", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/shops");
  await page.getByRole("main").getByRole("link", { name: "M6 Demo shop", exact: true }).click();
  await page.getByLabel("Shop name").fill("Keep these unsaved edits");
  const rejectLeave = async (click: () => Promise<unknown>, type: string) => {
    const dialog = page.waitForEvent("dialog");
    const action = click();
    const prompt = await dialog;
    expect(prompt.type()).toBe(type);
    await prompt.dismiss();
    await action;
    await expect(page).toHaveURL(new RegExp(`/admin/shops/${id}$`));
    await expect(page.getByLabel("Shop name")).toHaveValue("Keep these unsaved edits");
  };
  await rejectLeave(() => page.getByRole("banner").getByRole("link").first().click(), "confirm");
  const bottomLink = page.getByRole("navigation").last().getByRole("link").first();
  if (await bottomLink.isVisible()) await rejectLeave(() => bottomLink.click(), "confirm");
  await rejectLeave(() => page.getByRole("link", { name: "All shops", exact: true }).click(), "confirm");
  await rejectLeave(() => page.evaluate(() => history.back()), "beforeunload");
  await page.getByRole("button", { name: "Save changes privately" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Changes saved privately");
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/shops$/);
});

test('photos and logos save privately, preview and publish explicitly', async ({page}, testInfo) => {
  await setup(page);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
  const uploadId = '73000000-0000-4000-8000-000000000010';
  const imageId = '73000000-0000-4000-8000-000000000020';
  let uploaded = false, terminalFailure = true, initiations = 0;
  let entries: {id:string;kind:string;width:number;height:number;altText:string;creditText:null;status:string;revision:string}[] = [];
  const operations: string[] = [];
  await page.route('**/api/v1/admin/media/uploads**',async route => {
    const request=route.request();
    if (request.url().endsWith('/uploads')) {
      initiations++;
      const manifest=request.postDataJSON();
      expect(Object.keys(manifest).sort()).toEqual(['shopId','purpose','sha256','byteSize','contentType'].sort());
      expect(manifest.shopId).toBe(id);
      expect(manifest.purpose).toBe('shop_photo');
      await route.fulfill({json:{id:uploadId,status:'pending'}});
    } else if (terminalFailure) {
      terminalFailure=false;
      await route.fulfill({status:410,json:{error:{code:'upload_expired'}}});
    } else if (request.method()==='PUT') {
      uploaded=true; await route.fulfill({json:{id:uploadId,status:'uploaded'}});
    } else {
      await route.fulfill(uploaded ? {json:{id:uploadId,status:'validated'}} : {status:409,json:{error:{code:'upload_incomplete'}}});
    }
  });
  await page.route(`**/api/v1/admin/shops/${id}/media**`,async route => {
    const request=route.request();
    if (request.url().endsWith(`/${imageId}`)) {
      await route.fulfill({contentType:'image/png',body:png});return;
    }
    if (request.method()==='POST') {
      const body=request.postDataJSON();operations.push(body.action);
      if (body.action==='attach') {
        expect(body.id).toBe(uploadId);
        entries=[{id:imageId,kind:'photo',width:1,height:1,altText:'Photo of M6 Demo shop',creditText:null,status:'draft',revision:'a'.repeat(32)}];
      } else entries=entries.map(e=>({...e,status:body.action==='publish'?'approved':'draft',revision:'b'.repeat(32)}));
    }
    await route.fulfill({json:{entries}});
  });
  await page.goto(`/admin/shops/${id}`);
  const section=page.getByRole('region',{name:'Shop photos and logo'});
  await expect(section.getByLabel('Choose photo')).toBeEnabled();
  await section.getByLabel('Choose photo').setInputFiles({name:'demo-photo.png',mimeType:'image/png',buffer:png});
  await expect(section.getByAltText('Selected photo for M6 Demo shop')).toBeVisible();
  await section.getByRole('button',{name:'Save photo privately'}).click();
  await expect(section.getByRole('alert')).toContainText('Save again');
  await section.getByRole('button',{name:'Save photo privately'}).click();
  await expect(section.getByRole('status')).toContainText('Saved privately');
  expect(initiations).toBe(2);
  expect(operations).toEqual(['attach']);
  await expect(section.getByAltText('Photo of M6 Demo shop')).toBeVisible();
  await section.getByRole('button',{name:'Publish photo 1'}).click();
  expect(operations).toEqual(['attach']);
  await section.getByRole('button',{name:'Confirm publish'}).click();
  await expect(section.getByText('Photo 1 · Published when shop is public')).toBeVisible();
  await section.getByRole('button',{name:'Hide photo 1'}).click();
  await section.getByRole('button',{name:'Confirm hide'}).click();
  await expect(section.getByText('Photo 1 · Private',{exact:true})).toBeVisible();
  await section.getByLabel('Choose logo').setInputFiles({name:'demo-logo.png',mimeType:'image/png',buffer:png});
  await expect(section.getByAltText('Selected logo for M6 Demo shop')).toBeVisible();
  expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('[aria-label="Shop photos and logo"]').analyze()).violations).toEqual([]);
  await section.screenshot({path:testInfo.outputPath('admin-media-preview.png')});
});

test('stamp draft upload previews and explicit activation preserve earlier versions', async ({page}, testInfo) => {
  await setup(page);
  const versionId='76000000-0000-4000-8000-000000000001';
  const stampId='76000000-0000-4000-8000-000000000002';
  const uploadId='76000000-0000-4000-8000-000000000003';
  // Explicit synthetic 3:2 artwork, with transparency and one teal ink.
  // Transport is mocked; byte validation and real issuance have separate suites.
  const raw=Buffer.alloc((1200*4+1)*800);
  for(let y=80;y<720;y++) for(let x=80;x<1120;x++) {
    const border=x<96||x>=1104||y<96||y>=704;
    const nib=Math.abs(x-600)/220+Math.abs(y-380)/220;
    if(border||(nib>=0.93&&nib<=1)||(Math.abs(x-600)<8&&y>=380&&y<=600)) {
      const p=y*(1200*4+1)+1+x*4;raw[p]=35;raw[p+1]=105;raw[p+2]=106;raw[p+3]=255;
    }
  }
  const png=makePng(1200,800,{raw});
  const generated={id:'76000000-0000-4000-8000-000000000004',stampId,designVersion:1,kind:'generated_template',origin:'generated_template',status:'approved',ink:'teal',creatorName:null,creatorUrl:null,hasArtwork:false,active:true,revision:'a'.repeat(32)};
  const uploaded={id:versionId,stampId,designVersion:2,kind:'uploaded',origin:'ai_assisted',status:'draft',ink:'teal',creatorName:'Gin + AI',creatorUrl:'https://example.test/gin',hasArtwork:false,active:false,revision:'b'.repeat(32)};
  let created=false,transferred=false,expired=true,initiations=0;
  const actions:string[]=[];
  await page.route('**/api/v1/admin/media/uploads**',async route=>{
    const r=route.request();
    if(r.url().endsWith('/uploads')) {
      initiations++;
      expect(r.postDataJSON()).toMatchObject({shopId:id,artworkVersionId:versionId,purpose:'artwork_png',contentType:'image/png'});
      expect(Object.keys(r.postDataJSON()).sort()).toEqual(['shopId','artworkVersionId','purpose','sha256','byteSize','contentType'].sort());
      await route.fulfill({json:{id:uploadId}});
    } else if(expired) {expired=false;await route.fulfill({status:410,json:{error:{code:'upload_expired'}}});}
    else if(r.method()==='PUT') {transferred=true;await route.fulfill({json:{id:uploadId}});}
    else await route.fulfill(transferred?{json:{id:uploadId,status:'validated'}}:{status:409,json:{error:{code:'upload_incomplete'}}});
  });
  await page.route(`**/api/v1/admin/shops/${id}/stamp**`,async route=>{
    const r=route.request();
    if(r.url().endsWith(`/${versionId}`)) {await route.fulfill({contentType:'image/png',body:png});return;}
    if(r.method()==='POST') {
      const body=r.postDataJSON(); actions.push(body.action);
      if(body.action==='create') {
        expect(body).toEqual({action:'create',origin:'ai_assisted',creatorName:'Gin + AI',creatorUrl:'https://example.test/gin',ink:'teal'});created=true;
      } else if(body.action==='attach') {expect(body).toEqual({action:'attach',versionId,uploadId});uploaded.hasArtwork=true;}
      else if(body.action==='activate') {expect(body.revision).toBe(uploaded.revision);uploaded.status='approved';uploaded.active=true;generated.active=false;}
    }
    await route.fulfill({json:{entries:created?[uploaded,generated]:[generated]}});
  });
  await page.goto(`/admin/shops/${id}`);
  const section=page.getByRole('region',{name:'Atlas Stamp artwork'});
  await section.getByText('Create uploaded stamp version',{exact:true}).click();
  await expect(section.getByLabel('Creator name',{exact:true})).toBeEnabled();
  await section.getByRole('combobox',{name:/^Origin/}).selectOption('ai_assisted');
  await section.getByLabel('Creator name',{exact:true}).fill('Gin + AI');
  await section.getByLabel('Creator link (optional)').fill('https://example.test/gin');
  await section.getByRole('button',{name:'Create private draft'}).click();
  await expect(section.getByRole('status')).toContainText('Draft stamp version created');
  await section.getByLabel('Stamp PNG').setInputFiles({name:'demo-stamp.png',mimeType:'image/png',buffer:png});
  await section.getByRole('button',{name:'Save PNG privately'}).click();
  await expect(section.getByRole('alert')).toContainText('Save again');
  await section.getByRole('button',{name:'Save PNG privately'}).click();
  await expect(section.getByRole('status')).toContainText('Stamp PNG attached privately');
  expect(initiations).toBe(2);
  for(const label of ['List','Passport','Detail']) await expect(section.getByAltText(`${label}-size stamp preview`)).toBeVisible();
  await expect(section.getByRole('link',{name:'Gin + AI'})).toHaveAttribute('href','https://example.test/gin');
  await section.getByRole('button',{name:'Activate this design (admin)'}).click();
  expect(actions).toEqual(['create','attach']);
  await section.getByRole('button',{name:'Confirm activation'}).click();
  await expect(section.getByRole('status')).toContainText('Historical versions and impressions were preserved');
  await expect(section.getByText('Design v1',{exact:true})).toBeVisible();
  await expect(section.getByText('Design v2',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('[aria-label="Atlas Stamp artwork"]').analyze()).violations).toEqual([]);
  await section.screenshot({path:testInfo.outputPath('admin-stamp-preview.png')});
});

test('infrastructure HTML keeps unsaved edits and media reload recovery usable', async ({page}, info) => {
  await setup(page);
  let failMedia = true;
  await page.route(`**/api/v1/admin/shops/${id}/media`, async route => {
    await route.fulfill(failMedia ? {status: 500, contentType: 'text/html', body: '<html>private provider text</html>'}
      : {json: {entries: []}});
  });
  await page.route(`**/api/v1/admin/shops/${id}/stamp`, async route => {
    await route.fulfill({status: 502, contentType: 'text/html', body: '<html>private provider text</html>'});
  });
  await page.route(`**/api/v1/admin/shops/${id}`, async route => {
    if (route.request().method() === 'GET') { await route.fallback(); return; }
    await route.fulfill({status: 500, contentType: 'text/html', body: '<html>private provider text</html>', headers: {'CF-Ray': 'a3d9cfc85b0b0b21-SIN'}});
  });
  await page.goto(`/admin/shops/${id}`);
  const media = page.getByRole('region', {name: 'Shop photos and logo'});
  const stamp = page.getByRole('region', {name: 'Atlas Stamp artwork'});
  await expect(media.getByRole('alert')).toContainText('HTTP 500');
  await expect(stamp.getByRole('alert')).toContainText('HTTP 502');
  await expect(media.getByLabel('Choose photo')).toBeDisabled();
  await page.getByLabel('Shop name').fill('Keep my unsaved work');
  await page.getByRole('button', {name: 'Save changes privately'}).click();
  await expect(page.getByText(/Your last action may have completed/)).toBeVisible();
  await expect(page.getByLabel('Shop name')).toHaveValue('Keep my unsaved work');
  await expect(page.getByRole('main')).not.toContainText('private provider text');
  await expect(page.getByRole('main')).not.toContainText('Unexpected token');
  failMedia = false;
  await media.getByRole('button', {name: 'Reload media'}).click();
  await expect(media.getByLabel('Choose photo')).toBeEnabled();
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({path: info.outputPath('admin-infrastructure-recovery.png'), fullPage: true});
});

test('generated default preview and retry preserve unsaved shop edits @short',async({page},info)=>{
  await setup(page);
  let entries:unknown[]=[];
  const actions:string[]=[];
  await page.route(`**/api/v1/admin/shops/${id}/stamp`,async route=>{
    if(route.request().method()==='POST') {
      const body=route.request().postDataJSON();actions.push(body.action);
      expect(body).toEqual({action:'ensure_default'});
      entries=[{id:'78000000-0000-4000-8000-000000000010',stampId:'78000000-0000-4000-8000-000000000011',
        designVersion:1,kind:'generated_template',origin:'generated_template',status:'approved',ink:'teal',creatorName:null,creatorUrl:null,
        templateData:{tier:'shop',motif:'nib'},hasArtwork:false,active:true,revision:'c'.repeat(32)}];
    }
    await route.fulfill({json:{entries}});
  });
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByRole('button',{name:'Prepare generated default'})).toBeEnabled();
  await page.getByLabel('Shop name').fill('Unsaved name kept');
  await page.getByRole('button',{name:'Prepare generated default'}).click();
  const stamps=page.getByRole('region',{name:'Atlas Stamp artwork'});
  await expect(stamps.getByRole('img',{name:/Shop stamp, M6 Demo shop/})).toBeVisible();
  await expect(page.getByLabel('Shop name')).toHaveValue('Unsaved name kept');
  await expect(page.getByRole('button',{name:'Save changes privately'})).toBeEnabled();
  await expect(stamps.getByText(/no upload or creator credit needed/)).toBeVisible();
  await page.getByRole('button',{name:'Reload stamps'}).click();
  await expect(stamps.getByRole('img',{name:/Shop stamp, M6 Demo shop/})).toHaveCount(1);
  expect(actions).toEqual(['ensure_default']);
  await expect(page.getByRole('button',{name:'Prepare generated default'})).toHaveCount(0);
  expect(await page.evaluate(()=>window.document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await stamps.screenshot({path:info.outputPath('admin-generated-default.png')});
});
