import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { stubSession } from "../support/auth";
import { jpeg as makeJpeg } from "../../src/server/media/jpeg.fixture";
import { validatePng } from "../../src/server/media/png";
import { createHash } from "node:crypto";
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

/** Section nav is the editor's only navigation; every test reaches fields this way. */
const open = (page: Page, title: string) =>
  page.getByRole("navigation", { name: "Editor sections" }).getByRole("button", { name: title }).click();
const publicPreview = (page: Page) => page.frameLocator('iframe[title="Saved public-page preview"]');
const bar = (page: Page) => page.locator("main").getByRole("button", { name: /^(Save|Save and review|Review and publish|Saving…|Working…)$/ });
const save = (page: Page) => page.getByRole("button", { name: "Save", exact: true }).click();
const saveAndReview = (page: Page) =>
  page.getByRole("button", { name: "Save and review", exact: true }).click();

async function setup(page: Page, initial?: ShopRecord) {
  await stubSession(page, { kind: "signed-in" });
  await page.route("**/api/v1/admin/access",route=>route.fulfill({json:{role:"admin"}}));
  let record = initial ?? fixture();
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
        types: [{ id: type, label: "Fountain Pen Specialist", code: "fountain_pen_specialist" }],
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
        if (request.action === "confirm_position") {
          record.positionConfirmed = true;
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
    current: () => structuredClone(record),
    conflict: () => {
      conflict = true;
    },
  };
}

test("all seven approved sections are directly reachable @short", async ({ page }, info) => {
  await setup(page);
  await page.goto(`/admin/shops/${id}`);
  const nav = page.getByRole("navigation", { name: "Editor sections" });
  for (const title of [
    "Shop & story",
    "Experiences",
    "Location",
    "Visit details",
    "Photos & logo",
    "Stamp",
    "Review",
  ]) {
    await nav.getByRole("button", { name: title }).click();
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  }
  // Reached directly, in any order, without stepping through the ones between.
  await nav.getByRole("button", { name: "Location" }).click();
  await expect(page.getByLabel("Shop latitude")).toHaveValue("1.3");
  await nav.getByRole("button", { name: "Shop & story" }).click();
  await expect(page.getByLabel("Shop name")).toHaveValue("M6 Demo shop");
  expect(
    await page.evaluate(
      () => window.document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath(`admin-sections-${info.project.name}.png`),
    fullPage: true,
  });
});

test("founder edits, reviews, publishes, closes and archives @short", async ({
  page,
}, info) => {
  const state = await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByLabel("Shop name")).toHaveValue("M6 Demo shop");
  await page.getByLabel("Shop name").fill("M6 Revised demo shop");
  await saveAndReview(page);
  // Feedback for the action sits at the top of the work area, not below the fold.
  await expect(page.getByRole("main").getByRole("status").first()).toContainText(
    "Saved privately",
  );
  await expect(page.getByRole("heading", { level: 2, name: "Review", exact: true })).toBeVisible();
  await expect(
    publicPreview(page).getByRole("heading", { name: "M6 Revised demo shop" }).first(),
  ).toBeVisible();
  const preview = publicPreview(page).getByRole("article", { name: "Public page preview" });
  await expect(preview.getByText("Private internal note")).toHaveCount(0);
  await expect(preview.getByText("012345", { exact: false })).toBeVisible();
  await expect(preview.getByText("+65 0000 0000", { exact: false })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath(`admin-review-${info.project.name}.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Publish shop", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status").first()).toContainText(
    "Shop published",
  );
  for (const action of ["temporarily closed", "open", "permanently closed"]) {
    await page.getByRole("button", { name: `Mark ${action}`, exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: `Mark ${action}`, exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("status").first()).toContainText(
      "Operational status updated",
    );
  }
  await page.getByRole("button", { name: "Archive shop", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Archive shop", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("status").first()).toContainText(
    "Shop archived",
  );
  await open(page, "Shop & story");
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
  await open(page, "Visit details");
  await expect(page.getByLabel("Appointment required")).toHaveValue("");
  await open(page, "Experiences");
  await expect(page.getByRole("group", { name: /^Shop types/ })).toBeVisible();
  await open(page, "Review");
  await page.getByText("Legacy provenance · retained, not required", { exact: true }).click();
  await expect(page.getByRole("group", { name: /^Legacy sources/ })).toBeVisible();
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
  await open(page, "Shop & story");
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
  // These exact accessible names are what the Worker-authentication journey
  // drives; a hint inside the label would silently widen them.
  await page.getByLabel("Shop name", { exact: true }).fill("Another demo");
  await page.getByLabel("URL name · optional", { exact: true }).fill("another-demo");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/shops\/[a-f0-9-]{36}$/);
  await expect(page.getByRole("navigation", { name: "Editor sections" })).toBeVisible();
  await expect(page.getByLabel("Shop name")).toHaveValue("Another demo");
  state.conflict();
  await page.getByLabel("Shop name").fill("Uncommitted demo");
  await save(page);
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
  await save(page);
  await expect(page.getByRole("main").getByRole("status").first()).toContainText(
    "Saved privately",
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
  const bottomLink = page.getByRole("navigation", { name: /^(?!Editor sections)/ }).last().getByRole("link").first();
  if (await bottomLink.isVisible()) await rejectLeave(() => bottomLink.click(), "confirm");
  await rejectLeave(() => page.getByRole("link", { name: "All shops", exact: true }).click(), "confirm");
  await rejectLeave(() => page.evaluate(() => history.back()), "beforeunload");
  await save(page);
  await expect(page.getByRole("main").getByRole("status").first()).toContainText("Saved privately");
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/shops$/);
});

test('photos save privately, states are explicit and removal is honest', async ({page}, testInfo) => {
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
  await open(page,'Photos & logo');
  const section=page.getByRole('region',{name:'Shop photos and logo'});
  await expect(section.getByLabel('Choose a photo')).toBeEnabled();
  await section.getByLabel('Choose a photo').setInputFiles({name:'demo-photo.png',mimeType:'image/png',buffer:png});
  // The first attempt fails; the chosen file stays on screen with a retry.
  await expect(section.getByAltText('Selected photo for M6 Demo shop')).toBeVisible();
  await expect(section.getByRole('alert')).toContainText('Try again');
  await expect(page.getByRole('status').filter({hasText:'Shop details saved · media changes not saved'})).toBeVisible();
  await expect(section.getByText('demo-photo.png',{exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).include('[aria-label="Shop photos and logo"]').analyze()).violations).toEqual([]);
  await section.getByRole('button',{name:'Retry saving this photo'}).click();
  await expect(section.getByRole('status').filter({hasText:/^Saved privately\./})).toContainText('Saved privately');
  expect(initiations).toBe(2);
  expect(operations).toEqual(['attach']);
  await expect(section.getByAltText('Photo of M6 Demo shop')).toBeVisible();
  await expect(section.getByRole('figure').getByText('Private to this draft',{exact:true})).toBeVisible();
  // Permanent deletion is not advertised by this deployment, so no dead control.
  await expect(section.getByRole('button',{name:'Delete image'})).toHaveCount(0);
  await expect(section.getByText(/Deleting an image for good is not available yet/)).toBeVisible();
  await section.getByRole('button',{name:'Show on public page'}).click();
  expect(operations).toEqual(['attach']);
  const dialog=page.getByRole('alertdialog');
  await expect(dialog).toContainText('not published yet');
  await dialog.getByRole('button',{name:'Show on public page'}).click();
  await expect(section.getByRole('figure').getByText('Shown when shop is published',{exact:true})).toBeVisible();
  await section.getByRole('button',{name:'Remove from public page'}).click();
  await expect(page.getByRole('alertdialog')).toContainText('stays saved in this draft');
  await page.getByRole('alertdialog').getByRole('button',{name:'Remove from public page'}).click();
  await expect(section.getByRole('figure').getByText('Private to this draft',{exact:true})).toBeVisible();
  expect(operations).toEqual(['attach','publish','hide']);
  // Review reports public image state, so the path from upload to the public
  // page is visible where publication is actually decided.
  await open(page,'Review');
  await expect(page.getByText('Images: 1 saved · 0 shown on the public page')).toBeVisible();
  await page.getByRole('button',{name:'Go to Photos & logo'}).click();
  await expect(page.getByRole('heading',{level:2,name:'Photos & logo'})).toBeVisible();
  expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('[aria-label="Shop photos and logo"]').analyze()).violations).toEqual([]);
  await section.screenshot({path:testInfo.outputPath('admin-media-preview.png')});
});

test('advertised removal capability renders a delete control with live/draft wording @short', async ({page}) => {
  await setup(page);
  const imageId='73000000-0000-4000-8000-000000000021';
  let entries=[{id:imageId,kind:'photo',width:1,height:1,altText:'Photo of M6 Demo shop',creditText:null,status:'approved',revision:'a'.repeat(32)}];
  const operations:string[]=[];
  await page.route(`**/api/v1/admin/shops/${id}/media**`,async route=>{
    const request=route.request();
    if (request.url().endsWith(`/${imageId}`)) { await route.fulfill({status:404,json:{error:{code:'media_not_found'}}}); return; }
    if (request.method()==='POST') {
      const body=request.postDataJSON();operations.push(body.action);
      if (body.action==='remove') entries=[];
    }
    await route.fulfill({json:{entries,capabilities:['remove']}});
  });
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Photos & logo');
  const section=page.getByRole('region',{name:'Shop photos and logo'});
  await section.getByRole('button',{name:'Delete image'}).click();
  const dialog=page.getByRole('alertdialog');
  await expect(dialog).toContainText('currently on the public page');
  await expect(dialog).toContainText('cannot be undone');
  await dialog.getByRole('button',{name:'Delete image'}).click();
  await expect(section.getByRole('status')).toContainText('Image deleted');
  expect(operations).toEqual(['remove']);
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
  await page.route(`**/api/v1/admin/shops/${id}`, route => route.fulfill({json:{...fixture(),publicationErrors:uploaded.active ? [] : ['Prepare an active Atlas Stamp with approved artwork (artwork package).']}}));
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
  await open(page,'Stamp');
  const section=page.getByRole('region',{name:'Atlas Stamp artwork'});
  await section.getByText('Create uploaded stamp version',{exact:true}).click();
  await expect(section.getByLabel('Creator name (optional)',{exact:true})).toBeEnabled();
  await section.getByRole('combobox',{name:/^Origin/}).selectOption('ai_assisted');
  await section.getByLabel('Creator name (optional)',{exact:true}).fill('Gin + AI');
  await section.getByLabel('Creator link (optional)').fill('https://example.test/gin');
  await section.getByRole('button',{name:'Create private draft'}).click();
  await expect(section.getByRole('status')).toContainText('Draft stamp version created');
  await section.getByLabel('Stamp PNG').setInputFiles({name:'wrong-type.jpg',mimeType:'image/jpeg',buffer:Buffer.from('invalid')});
  await expect(section.getByRole('alert')).toContainText('transparent PNG up to 5 MiB');
  expect(initiations).toBe(0);
  await expect(page.getByRole('status').filter({hasText:'Shop details saved · media changes not saved'})).toBeVisible();
  page.once('dialog',dialog=>dialog.dismiss());
  await open(page,'Photos & logo');
  await expect(section.getByLabel('Stamp PNG')).toBeVisible();
  await section.getByRole('button',{name:'Clear selected file'}).click();
  await expect(section.getByText('No file chosen')).toBeVisible();
  await section.getByLabel('Stamp PNG').setInputFiles({name:'demo-stamp.png',mimeType:'image/png',buffer:png});
  await expect(section.getByRole('alert')).toContainText('Save again');
  await section.getByRole('button',{name:'Save PNG privately'}).click();
  await expect(section.getByRole('status').filter({hasText:'Stamp PNG attached privately'})).toContainText('Stamp PNG attached privately');
  expect(initiations).toBe(2);
  for(const label of ['List','Passport','Detail']) await expect(section.getByAltText(`${label}-size stamp preview`)).toBeVisible();
  await expect(section.getByRole('link',{name:'Gin + AI'})).toHaveAttribute('href','https://example.test/gin');
  await section.getByRole('button',{name:'Activate this design (admin)'}).click();
  expect(actions).toEqual(['create','attach']);
  await section.getByRole('button',{name:'Confirm activation'}).click();
  await expect(section.getByRole('status')).toContainText('Historical versions and impressions were preserved');
  await open(page,'Review');
  await expect(page.getByRole('button',{name:'Publish shop',exact:true})).toBeEnabled();
  await open(page,'Stamp');
  await expect(section.getByText('Design v1',{exact:true})).toBeVisible();
  await expect(section.getByText('Design v2',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('[aria-label="Atlas Stamp artwork"]').analyze()).violations).toEqual([]);
  await section.screenshot({path:testInfo.outputPath('admin-stamp-preview.png')});
});

test('curated experience icons survive private save and reopen @short', async ({page}, info) => {
  const initial=fixture();
  initial.document.experiences=[{id:source,category:'nib_testing',title:'Synthetic nib testing',description:'Try a selection.'}];
  const state=await setup(page,initial);
  await page.goto(`/admin/shops/${id}`); await open(page,'Experiences');
  const picker=page.getByRole('radiogroup',{name:'Experience icon',exact:true});
  await expect(picker.getByRole('radio',{name:'Writing',exact:true})).toBeChecked();
  await expect(picker.getByRole('radio')).toHaveCount(10);
  await picker.getByRole('radio',{name:'Ink bottles',exact:true}).check();
  await expect(picker.getByRole('radio',{name:'Ink bottles',exact:true})).toBeChecked();
  expect(state.current().document.experiences[0]?.icon ?? null).toBeNull();
  await page.screenshot({path:info.outputPath('admin-experience-icons.png'),fullPage:true});
  await save(page);
  await expect.poll(()=>state.current().document.experiences[0]?.icon).toBe('ink');
  expect(state.current().publicationStatus).toBe('draft');
  expect(state.actions).toEqual(['save']);
  await page.reload(); await open(page,'Experiences');
  await expect(picker.getByRole('radio',{name:'Ink bottles',exact:true})).toBeChecked();
  await picker.getByRole('radio',{name:'Ink bottles',exact:true}).press('ArrowRight');
  await expect(picker.getByRole('radio',{name:'Ink swatching',exact:true})).toBeChecked();
  expect(await page.evaluate(()=>window.document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('main').analyze()).violations).toEqual([]);
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
  await open(page, 'Photos & logo');
  const media = page.getByRole('region', {name: 'Shop photos and logo'});
  await expect(media.getByRole('alert')).toContainText('HTTP 500');
  await expect(media.getByLabel('Choose a photo')).toBeDisabled();
  await open(page, 'Stamp');
  const stamp = page.getByRole('region', {name: 'Atlas Stamp artwork'});
  await expect(stamp.getByRole('alert')).toContainText('HTTP 502');
  await open(page, 'Shop & story');
  await page.getByLabel('Shop name').fill('Keep my unsaved work');
  await save(page);
  await expect(page.getByText(/Your last action may have completed/)).toBeVisible();
  await expect(page.getByLabel('Shop name')).toHaveValue('Keep my unsaved work');
  await expect(page.getByRole('main')).not.toContainText('private provider text');
  await expect(page.getByRole('main')).not.toContainText('Unexpected token');
  failMedia = false;
  await open(page, 'Photos & logo');
  await media.getByRole('button', {name: 'Reload images'}).click();
  await expect(media.getByLabel('Choose a photo')).toBeEnabled();
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
  await page.getByLabel('Shop name').fill('Unsaved name kept');
  await open(page,'Stamp');
  const stamps=page.getByRole('region',{name:'Atlas Stamp artwork'});
  await expect(page.getByRole('button',{name:'Prepare generated default'})).toBeEnabled();
  await page.getByRole('button',{name:'Prepare generated default'}).click();
  await expect(stamps.getByRole('img',{name:/Shop stamp, M6 Demo shop/})).toBeVisible();
  await expect(stamps.getByText(/no upload or creator credit needed/)).toBeVisible();
  await page.getByRole('button',{name:'Reload stamps'}).click();
  await expect(stamps.getByRole('img',{name:/Shop stamp, M6 Demo shop/})).toHaveCount(1);
  expect(actions).toEqual(['ensure_default']);
  await expect(page.getByRole('button',{name:'Prepare generated default'})).toHaveCount(0);
  expect(await page.evaluate(()=>window.document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await stamps.screenshot({path:info.outputPath('admin-generated-default.png')});
  // Preparing artwork is a separate operation: it must not touch the document.
  await open(page,'Shop & story');
  await expect(page.getByLabel('Shop name')).toHaveValue('Unsaved name kept');
  await expect(bar(page).first()).toBeEnabled();
});

test('invalid entry, actionable error, correction and successful save @short',async({page},info)=>{
  const state=await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await page.getByLabel('Shop name').fill('Unsaved synthetic name');
  await page.getByLabel('Official website').fill('https://');
  await open(page,'Location');
  await page.getByLabel('Shop latitude').fill('91');
  await save(page);
  const errors=page.getByRole('list',{name:'Fields to correct'});
  await expect(errors).toBeVisible();
  expect(state.actions).toEqual([]);
  // The error names a field, the nav flags its section, and the link lands on it.
  await expect(page.getByRole('navigation',{name:'Editor sections'})
    .getByRole('button',{name:/Shop & story/})).toContainText('!');
  await errors.getByRole('button',{name:/Shop latitude/}).click();
  await expect(page.getByLabel('Shop latitude')).toBeFocused();
  await expect(page.getByLabel('Shop latitude')).toHaveAttribute('aria-invalid','true');
  await page.screenshot({path:info.outputPath('admin-field-errors.png'),fullPage:true});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>window.document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  // Correcting the field clears its stale error immediately.
  await page.getByLabel('Shop latitude').fill('0');
  await expect(page.getByLabel('Shop latitude')).not.toHaveAttribute('aria-invalid','true');
  await errors.getByRole('button',{name:/Official website/}).click();
  await expect(page.getByLabel('Official website')).toBeFocused();
  await page.getByLabel('Official website').fill('https://example.test');
  await save(page);
  await expect(page.getByRole('main').getByRole('status').first()).toContainText('Saved privately');
  await expect(page.getByRole('list',{name:'Fields to correct'})).toHaveCount(0);
  await expect(page.getByLabel('Shop name')).toHaveValue('Unsaved synthetic name');
  expect(state.actions).toEqual(['save']);
});

test('timezone is a searchable list of IANA zones with current offsets @short',async({page},info)=>{
  const state=await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Visit details');
  const field=page.getByRole('combobox',{name:'Timezone'});
  await expect(field).toHaveValue(/Singapore, Asia — UTC\+08:00/);
  await field.click();
  await field.fill('tokyo');
  const list=page.getByRole('listbox',{name:'Timezones'});
  await expect(list.getByRole('option',{name:/Tokyo, Asia/})).toBeVisible();
  await expect(list.getByRole('option',{name:/Asia\/Tokyo/})).toContainText('UTC+09:00');
  // A large, genuinely searchable set, not a handful of sample countries.
  await field.fill('');
  expect(await list.getByRole('option').count()).toBeGreaterThan(20);
  await field.fill('tokyo');
  await list.getByRole('option',{name:/Tokyo, Asia/}).click();
  await expect(field).toHaveValue(/Tokyo, Asia — UTC\+09:00/);
  await page.screenshot({path:info.outputPath('admin-timezone.png'),fullPage:true});
  expect((await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await save(page);
  await expect(page.getByRole('main').getByRole('status').first()).toContainText('Saved privately');
  expect(state.actions).toEqual(['save']);
});

test('B2 private notes, shared editorial preview and deliberate position review @short', async ({ page }, info) => {
  const state = await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await page.getByLabel('Why this place deserves a visit').fill('First paragraph.\n\n第二段。');
  await page.getByLabel('Feature headline').fill('A synthetic headline');
  await page.getByText('Internal admin notes · private', { exact: true }).click();
  await page.getByLabel('Internal admin notes (private)', { exact: true }).fill('B2 PRIVATE SENTINEL');
  await page.getByLabel('Reference links (private)', { exact: true }).fill('https://example.test/private-maintenance');
  await open(page, 'Location');
  // Position confirmation now sits beside the coordinates it attests to.
  await expect(page.getByRole('button', { name: 'Confirm saved shop position', exact: true })).toBeDisabled();
  await saveAndReview(page);
  await expect(publicPreview(page).getByText('First paragraph.', { exact: true })).toBeVisible();
  await expect(publicPreview(page).getByText('第二段。', { exact: true })).toBeVisible();
  await expect(page.getByText('B2 PRIVATE SENTINEL', { exact: true })).toHaveCount(0);
  await expect(page.getByText('https://example.test/private-maintenance', { exact: true })).toHaveCount(0);
  await open(page, 'Location');
  await page.getByRole('button', { name: 'Confirm saved shop position', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('you checked the saved address, coordinates');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm position', exact: true }).click();
  await expect(page.getByRole('main').getByRole('status').first()).toContainText('Saved position confirmed');
  await open(page, 'Review');
  await page.getByRole('button', { name: 'Publish shop', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('actual review time are recorded');
  await page.screenshot({ path: info.outputPath(`admin-b2-review-${info.project.name}.png`), fullPage: true });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('main').getByRole('status').first()).toContainText('Shop published');
  expect(state.actions).toEqual(['save', 'confirm_position', 'publish']);
});

test('save and review opens the saved review state and keeps a failed save @short', async ({page},info) => {
  const state = await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await page.getByLabel('Shop name').fill('Mobile review test shop');
  await saveAndReview(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Review', exact: true })).toBeVisible();
  await expect(publicPreview(page).getByRole('heading',{name:'Mobile review test shop'}).first()).toBeVisible();
  await expect(page.getByLabel('Shop name',{exact:true})).toHaveCount(0);
  expect(state.actions).toEqual(['save']);
  await page.screenshot({path:info.outputPath('admin-save-review.png'),fullPage:true});
  await open(page,'Shop & story');
  await page.getByLabel('Shop name').fill('Keep failed save');
  state.conflict();
  await saveAndReview(page);
  await expect(page.getByLabel('Shop name')).toHaveValue('Keep failed save');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('changed in another session');
});

test('publication blockers lead to the section that fixes them @short', async ({page}) => {
  await setup(page);
  await page.route(`**/api/v1/admin/shops/${id}`, route => route.fulfill({json:{
    ...fixture(),
    publicationErrors:[
      'Add the street address.',
      'Prepare an active Atlas Stamp with approved artwork (artwork package).',
    ],
  }}));
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Review');
  await expect(page.getByRole('button',{name:'Publish shop',exact:true})).toBeDisabled();
  await page.getByRole('listitem').filter({hasText:'Add the street address.'}).getByRole('button',{name:'Fix'}).click();
  await expect(page.getByRole('heading',{level:2,name:'Location'})).toBeVisible();
  await expect(page.getByLabel('Address line 1')).toBeFocused();
  await open(page,'Review');
  await page.getByRole('listitem').filter({hasText:'Atlas Stamp'}).getByRole('button',{name:'Fix'}).click();
  await expect(page.getByRole('heading',{level:2,name:'Stamp'})).toBeVisible();
});

test('empty brand and specialty choices offer add/reuse and become selectable @short', async ({page},info) => {
  await setup(page);
  const options = {localities:[{id:locality,label:'Singapore',countryCode:'SG'}],types:[{id:type,label:'Fountain Pen Specialist',code:'fountain_pen_specialist'}],services:[],brands:[] as {id:string;label:string}[],specialties:[] as {id:string;label:string}[]};
  await page.route('**/api/v1/admin/shops/options',async route => {
    if(route.request().method()==='POST') {
      const {kind,label}=route.request().postDataJSON() as {kind:'brands'|'specialties';label:string};
      const choice={id:kind==='brands'?'82000000-0000-4000-8000-000000000001':'82000000-0000-4000-8000-000000000002',label};
      options[kind]=[choice];
      await route.fulfill({json:{id:choice.id,options}});
    } else await route.fulfill({json:options});
  });
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Experiences');
  for (const [group,name,label] of [['Brands','brand','Synthetic test brand'],['Specialties','specialty','Synthetic specialty']]) {
    const fieldset=page.getByRole('group',{name:`${group} (0)`,exact:true});
    await expect(fieldset.getByRole('button',{name:`Add ${group!.toLowerCase()}`,exact:true})).toBeDisabled();
    await fieldset.getByLabel(`New ${name} name`).fill(label!);
    await fieldset.getByRole('button',{name:`Add or reuse ${name}`,exact:true}).click();
    const row=page.getByRole('group',{name:`${group} (1)`,exact:true});
    await expect(row.getByLabel('Item',{exact:false}).first()).toHaveValue(group==='Brands'?'82000000-0000-4000-8000-000000000001':'82000000-0000-4000-8000-000000000002');
  }
  await page.screenshot({path:info.outputPath('admin-choice-recovery.png'),fullPage:true});
  await saveAndReview(page);
  await expect(publicPreview(page).getByText('Saved private content · Public-page layout preview',{exact:true})).toBeVisible();
});

test('country is a searchable selector that stores the code @short',async({page})=>{
  const state=await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Location');
  const field=page.getByRole('combobox',{name:'Country'});
  await expect(field).toHaveValue('Singapore (SG)');
  await field.click();
  await field.fill('japan');
  const list=page.getByRole('listbox',{name:'Countries'});
  await expect(list.getByRole('option',{name:/Japan/})).toBeVisible();
  expect(await list.getByRole('option').count()).toBeGreaterThanOrEqual(1);
  await list.getByRole('option',{name:/^Japan/}).first().click();
  await expect(field).toHaveValue('Japan (JP)');
  // A withdrawn code CLDR still names must never be handed back for a country.
  await field.click();
  await field.fill('germany');
  await expect(list.getByRole('option').first()).toContainText('Germany');
  await expect(list.getByRole('option').first()).toContainText('DE');
  await expect(list.getByRole('option',{name:/DD/})).toHaveCount(0);
  // Storage accepts any two uppercase letters, so a typed code stays reachable.
  await field.fill('qq');
  await list.getByRole('option',{name:/Use the code QQ/}).click();
  await expect(field).toHaveValue('QQ');
  // Tabbing past the field — the input, then its Clear button — closes the list
  // and leaves the value readable instead of blank under an open listbox.
  await field.click();
  await expect(page.getByRole('listbox',{name:'Countries'})).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Clear country'})).toBeFocused();
  // The list is not itself a tab stop, so one more Tab leaves the field.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('listbox',{name:'Countries'})).toHaveCount(0);
  await expect(field).toHaveValue('QQ');
  await field.click();
  await field.fill('japan');
  await list.getByRole('option',{name:/^Japan/}).first().click();
  // The locality still belongs to Singapore, so this must fail at the locality.
  await saveAndReview(page);
  await expect(page.getByLabel('Locality',{exact:true})).toBeFocused();
  await expect(page.getByLabel('Locality',{exact:true})).toHaveAttribute('aria-invalid','true');
  await expect(page.getByRole('list',{name:'Fields to correct'})).toContainText('Choose a locality in the selected country');
  expect(state.actions).toEqual([]);
});

test('server field errors drive the same correction cycle as client ones @short', async ({page}) => {
  const state = await setup(page);
  // The client validator accepts this document; only the server rejects it, which
  // is the path the founder actually hit on the deployed system.
  let reject = true;
  await page.route(`**/api/v1/admin/shops/${id}`, async route => {
    if (route.request().method() !== 'POST' || !reject) { await route.fallback(); return; }
    reject = false;
    await route.fulfill({status:422,json:{ok:false,error:{code:'invalid_fields'},
      fieldErrors:[{path:'shop.postal_code',message:'Use a postal code valid for the selected country.'}]}});
  });
  await page.goto(`/admin/shops/${id}`);
  await page.getByLabel('Shop name').fill('Server-rejected name');
  await save(page);
  const errors = page.getByRole('list',{name:'Fields to correct'});
  await expect(errors).toContainText('Use a postal code valid for the selected country.');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Nothing was saved');
  // The section flag, the link and the entered data all behave as for a client error.
  await expect(page.getByRole('navigation',{name:'Editor sections'})
    .getByRole('button',{name:/Location/})).toContainText('!');
  await expect(page.getByRole('heading',{level:2,name:'Location'})).toBeVisible();
  await expect(page.getByLabel('Postal code')).toBeFocused();
  await expect(page.getByLabel('Postal code')).toHaveAttribute('aria-invalid','true');
  await page.getByLabel('Postal code').fill('018956');
  await expect(page.getByLabel('Postal code')).not.toHaveAttribute('aria-invalid','true');
  await save(page);
  await expect(page.getByRole('main').getByRole('status').first()).toContainText('Saved privately');
  await expect(page.getByRole('list',{name:'Fields to correct'})).toHaveCount(0);
  await open(page,'Shop & story');
  await expect(page.getByLabel('Shop name')).toHaveValue('Server-rejected name');
  // The rejected attempt is answered by this test's own route, so only the
  // successful retry reaches the shared handler.
  expect(state.actions).toEqual(['save']);
});

test('a refused publication replaces the blockers from the server @short', async ({page}) => {
  await setup(page);
  let refuse = true;
  await page.route(`**/api/v1/admin/shops/${id}`, async route => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    if (route.request().postDataJSON().action !== 'publish' || !refuse) { await route.fallback(); return; }
    refuse = false;
    await route.fulfill({status:422,json:{ok:false,error:{code:'publication_incomplete'},
      requirements:['Add the street address.']}});
  });
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Review');
  await expect(page.getByText('Nothing is blocking publication of the saved version.')).toBeVisible();
  await page.getByRole('button',{name:'Publish shop',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Publish',exact:true}).click();
  // The saved version's blockers are replaced by what the server actually said.
  await expect(page.getByRole('listitem').filter({hasText:'Add the street address.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish shop',exact:true})).toBeDisabled();
  await page.getByRole('listitem').filter({hasText:'Add the street address.'}).getByRole('button',{name:'Fix'}).click();
  await expect(page.getByLabel('Address line 1')).toBeFocused();
});

test('an archived shop is read-only everywhere, including legacy provenance @short', async ({page}) => {
  await setup(page);
  await page.route(`**/api/v1/admin/shops/${id}`, route =>
    route.fulfill({json:{...fixture(),publicationStatus:'archived'}}));
  await page.goto(`/admin/shops/${id}`);
  await expect(page.getByText(/archived and read-only/)).toBeVisible();
  await expect(page.getByLabel('Shop name')).toBeDisabled();
  await open(page,'Review');
  await page.getByText('Legacy provenance · retained, not required',{exact:true}).click();
  await expect(page.getByLabel('Source quality')).toBeDisabled();
  await expect(page.getByRole('button',{name:'Add legacy sources (optional)'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Publish shop',exact:true})).toHaveCount(0);
});

test('a refused image change closes the dialog and reports it @short', async ({page}) => {
  await setup(page);
  const imageId='73000000-0000-4000-8000-000000000030';
  // The refused change means the held revision is stale, so a retry can only
  // work if the list is re-read. The second read hands back a different one.
  let reads=0, posts=0;
  const entry=(revision:string)=>({id:imageId,kind:'photo',width:1,height:1,altText:'Photo of M6 Demo shop',creditText:null,status:'draft',revision});
  await page.route(`**/api/v1/admin/shops/${id}/media**`, async route => {
    const request=route.request();
    if (request.url().endsWith(`/${imageId}`)) { await route.fulfill({status:404,json:{error:{code:'media_not_found'}}}); return; }
    if (request.method()==='POST') {
      posts++;
      const body=request.postDataJSON();
      if (body.revision==='a'.repeat(32)) { await route.fulfill({status:409,json:{error:{code:'revision_conflict'}}}); return; }
      await route.fulfill({json:{entries:[{...entry('c'.repeat(32)),status:'approved'}]}});
      return;
    }
    reads++;
    await route.fulfill({json:{entries:[entry(reads===1 ? 'a'.repeat(32) : 'b'.repeat(32))]}});
  });
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Photos & logo');
  const section=page.getByRole('region',{name:'Shop photos and logo'});
  await section.getByRole('button',{name:'Show on public page'}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Show on public page'}).click();
  // No modal left open over a revision that can only fail again.
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(section.getByRole('alert')).toContainText('changed in another session');
  await expect(section.getByRole('button',{name:'Show on public page'})).toBeEnabled();
  expect(reads).toBe(2);
  // A failure takes focus to the message that explains it, never to the top of
  // the document; cancelling instead gives focus back to the trigger.
  await expect(section.locator('[role="alert"]').locator('xpath=..')).toBeFocused();
  await section.getByRole('button',{name:'Show on public page'}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(section.getByRole('button',{name:'Show on public page'})).toBeFocused();
  // The retry now carries the reloaded revision, so it succeeds.
  await section.getByRole('button',{name:'Show on public page'}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Show on public page'}).click();
  await expect(section.getByRole('figure').getByText('Shown when shop is published',{exact:true})).toBeVisible();
  expect(posts).toBe(2);
});

test('a confirmation dialog is modal and gives focus back @short', async ({page}) => {
  await setup(page);
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Review');
  const trigger=page.getByRole('button',{name:'Archive shop',exact:true});
  await trigger.click();
  const dialog=page.getByRole('alertdialog');
  await expect(dialog.getByRole('button',{name:'Archive shop',exact:true})).toBeFocused();
  // Tab cycles inside the dialog instead of reaching the app's own navigation.
  for (const name of ['Cancel','Archive shop','Cancel']) {
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button',{name,exact:true})).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('an editor sees no image control that needs an admin account @short', async ({page}) => {
  await setup(page);
  const imageId='73000000-0000-4000-8000-000000000031';
  await page.route('**/api/v1/admin/access', route => route.fulfill({json:{role:'editor'}}));
  await page.route(`**/api/v1/admin/shops/${id}/media**`, async route => {
    if (route.request().url().endsWith(`/${imageId}`)) { await route.fulfill({status:404,json:{error:{code:'media_not_found'}}}); return; }
    await route.fulfill({json:{entries:[{id:imageId,kind:'photo',width:1,height:1,altText:'Photo of M6 Demo shop',creditText:null,status:'draft',revision:'a'.repeat(32)}],capabilities:['remove']}});
  });
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Photos & logo');
  const section=page.getByRole('region',{name:'Shop photos and logo'});
  await expect(section.getByLabel('Choose a photo')).toBeEnabled();
  await expect(section.getByRole('button',{name:'Show on public page'})).toHaveCount(0);
  await expect(section.getByRole('button',{name:'Delete image'})).toHaveCount(0);
  await expect(section.getByText(/cannot change what is public/)).toBeVisible();
});

test('Review says so when it cannot check which images are public @short', async ({page}) => {
  await setup(page);
  let fail = true;
  await page.route(`**/api/v1/admin/shops/${id}/media`, async route => {
    await route.fulfill(fail ? {status:503,json:{error:{code:'service_unavailable'}}} : {json:{entries:[]}});
  });
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Review');
  await expect(page.getByText(/Could not check which images are on the public page/)).toBeVisible();
  fail = false;
  await page.getByRole('button',{name:'Check again'}).click();
  await expect(page.getByText('Images: 0 saved · 0 shown on the public page')).toBeVisible();
});

test('gallery arrangement binds all revisions, preserves private images and saves captions @short', async ({page},info) => {
  await setup(page);
  const ids=['84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002'];
  let entries=ids.map((id,index)=>({id,kind:'photo',width:2,height:2,altText:`Synthetic photo ${index+1}`,creditText:null,status:index ? 'draft':'approved',revision:'a'.repeat(32),sortOrder:index,caption:null as string|null}));
  const calls:Record<string,unknown>[]=[];
  await page.route(`**/api/v1/admin/shops/${id}/media**`,async route=>{
    if (!route.request().url().endsWith('/media')) {await route.fulfill({status:404});return;}
    if(route.request().method()==='POST') {
      const body=route.request().postDataJSON();calls.push(body);
      if(body.action==='arrange') entries=body.order.map((id:string,index:number)=>{
        const row=entries.find(e=>e.id===id)!;
        expect(body.revisions[id]).toBe(row.revision);
        return {...row,sortOrder:index,caption:Object.hasOwn(body.captions,id) ? body.captions[id]:row.caption,revision:row.revision==='a'.repeat(32)?'b'.repeat(32):'a'.repeat(32)};
      });
    }
    await route.fulfill({json:{entries,capabilities:['remove','arrange']}});
  });
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Photos & logo');
  const section=page.getByRole('region',{name:'Shop photos and logo'});
  await section.getByRole('button',{name:'Make cover'}).nth(1).click();
  await expect(section.locator('figure').first().getByRole('img')).toHaveAttribute('alt','Synthetic photo 2');
  await expect(section.locator('figure').first()).toContainText('Private to this draft');
  const caption='墨水 <script>literal text</script>';
  await section.getByLabel('Photo caption · optional').first().fill(caption);
  await section.getByRole('button',{name:'Save caption'}).first().click();
  await expect(section.getByRole('status')).toContainText('Gallery saved');
  await section.getByRole('button',{name:'Reload images'}).click();
  await expect(section.getByLabel('Photo caption · optional').first()).toHaveValue(caption);
  expect(calls.map(c=>c.action)).toEqual(['arrange','arrange']);
  expect((calls[0]!.order as string[])).toEqual([ids[1],ids[0]]);
  const violations=(await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  expect(violations).toEqual([]);
  await section.screenshot({path:info.outputPath('admin-gallery-arrangement.png')});
});

test('an unknown role never exposes admin-only image controls @short',async({page})=>{
  await setup(page);
  await page.route('**/api/v1/admin/access',route=>route.fulfill({status:503,json:{error:{code:'service_unavailable'}}}));
  await page.route(`**/api/v1/admin/shops/${id}/media**`,route=>route.fulfill({json:{entries:[{id:source,kind:'photo',width:1,height:1,altText:'Synthetic photo',creditText:null,status:'draft',revision:'a'.repeat(32)}],capabilities:['remove','arrange']}}));
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Photos & logo');
  const section=page.getByRole('region',{name:'Shop photos and logo'});
  await expect(section.getByRole('button',{name:'Show on public page'})).toHaveCount(0);
  await expect(section.getByRole('button',{name:'Delete image'})).toHaveCount(0);
  await expect(section.getByRole('button',{name:'Make cover'})).toHaveCount(0);
});

test('admin can create missing localities and types then save their selection @short',async({page},info)=>{
  const state=await setup(page);
  const newLocality='85000000-0000-4000-8000-000000000001',newType='85000000-0000-4000-8000-000000000002';
  const options={localities:[{id:locality,label:'Singapore (SG)',countryCode:'SG'}],types:[{id:type,label:'Fountain Pen Specialist',code:'fountain_pen_specialist'}],services:[],brands:[],specialties:[]};
  await page.route('**/api/v1/admin/shops/options',async route=>{
    if(route.request().method()==='POST') {
      const body=route.request().postDataJSON();
      if(body.kind==='localities') {
        expect(body.countryCode).toBe('SG');
        options.localities.push({id:newLocality,label:`${body.label} (SG)`,countryCode:'SG'});
      } else options.types.push({id:newType,label:body.label,code:`type_${newType.replaceAll('-','_')}`});
      await route.fulfill({json:{id:body.kind==='localities'?newLocality:newType,options}});
    } else await route.fulfill({json:options});
  });
  await page.goto(`/admin/shops/${id}`);
  await open(page,'Location');
  await page.getByLabel('New locality name').fill('Synthetic place');
  await page.getByRole('button',{name:'Add or reuse locality'}).click();
  await expect(page.getByLabel('Locality').first()).toHaveValue(newLocality);
  await open(page,'Experiences');
  await page.getByLabel('New shop type name').fill('Synthetic shop type');
  await page.getByRole('button',{name:'Add or reuse shop type'}).click();
  await expect(page.getByRole('status').filter({hasText:'Synthetic shop type selected'})).toBeVisible();
  await save(page);
  await expect(page.getByRole('main').getByRole('status').first()).toContainText('Saved privately');
  expect(state.actions).toContain('save');
  await page.reload();
  await open(page,'Experiences');
  await expect(page.locator('select:has(option[value="'+newType+'"]:checked)')).toHaveCount(1);
  await open(page,'Location');
  await expect(page.getByLabel('Locality').first()).toHaveValue(newLocality);
  await page.screenshot({path:info.outputPath('admin-locality-creation.png')});
});

for (const format of ['jpeg-disguised-as-png','wide-transparent-png','small-transparent-png'] as const) {
  test(`logo intake handles ${format} and preserves proportions @short`, async ({page}) => {
    await setup(page);
    const isPng=format!=='jpeg-disguised-as-png';
    const width=format==='wide-transparent-png'?1024:format==='small-transparent-png'?300:24;
    const height=format==='wide-transparent-png'?512:format==='small-transparent-png'?100:16;
    const inputWidth=format==='wide-transparent-png'?2400:300, inputHeight=format==='wide-transparent-png'?1200:100;
    const raw=Buffer.alloc((inputWidth*4+1)*inputHeight);
    for(let y=0;y<inputHeight;y++) for(let x=0;x<inputWidth/2;x++) raw.set([80,120,160,255],y*(inputWidth*4+1)+1+x*4);
    const original=isPng ? makePng(inputWidth,inputHeight,{raw}) : makeJpeg;
    const uploadId='89000000-0000-4000-8000-000000000010', imageId='89000000-0000-4000-8000-000000000020';
    let transferred=false, attachments=0, initiations=0, puts=0, manifest: Record<string,unknown>={};
    const entry={id:imageId,kind:'logo',width,height,altText:'Synthetic test logo',creditText:null,status:'draft',revision:'a'.repeat(32)};
    await page.route('**/api/v1/admin/media/uploads**',async route=>{
      const r=route.request();
      if(r.url().endsWith('/uploads')) {
        initiations++;manifest=r.postDataJSON();
        expect(manifest.purpose).toBe('shop_logo');
        expect(manifest.contentType).toBe(isPng?'image/png':'image/jpeg');
        await route.fulfill({json:{id:uploadId}});
      } else if(r.method()==='PUT') {
        const bytes=r.postDataBuffer()!;
        expect(r.headers()['content-type']).toBe(manifest.contentType);
        expect(bytes.length).toBe(manifest.byteSize);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
        if(isPng) {
          const pixels=new Uint8Array(width*height*4);
          const checked=validatePng(bytes,false,pixels);
          expect([checked.width,checked.height]).toEqual([width,height]);
          expect(Array.from(pixels.slice((10*width+10)*4,(10*width+10)*4+4))).toEqual([80,120,160,255]);
          expect(pixels[(10*width+width-10)*4+3]).toBe(0); // transparent half remains transparent
        } else expect(bytes.equals(original)).toBe(true);
        puts++;
        if(isPng && puts===1) {await route.fulfill({status:503,json:{error:{code:'service_unavailable'}}});return;}
        transferred=true;await route.fulfill({json:{id:uploadId}});
      } else await route.fulfill(transferred?{json:{id:uploadId,status:'validated'}}:{status:409,json:{error:{code:'upload_incomplete'}}});
    });
    await page.route(`**/api/v1/admin/shops/${id}/media**`,async route=>{
      if(route.request().url().endsWith(imageId)) {await route.fulfill({contentType:'image/png',body:makePng(entry.width,entry.height)});return;}
      if(route.request().method()==='POST') {expect(route.request().postDataJSON()).toEqual({action:'attach',id:uploadId});attachments++;}
      await route.fulfill({json:{entries:attachments?[entry]:[]}});
    });
    await page.goto(`/admin/shops/${id}`);await open(page,'Photos & logo');
    const media=page.getByRole('region',{name:'Shop photos and logo'});
    await media.getByLabel('Choose a logo').setInputFiles({name:'synthetic-logo.png',mimeType:'image/png',buffer:original});
    if(isPng) {
      await expect(media.getByRole('alert')).toContainText('Media service is unavailable');
      await media.getByRole('button',{name:'Retry saving this logo'}).click();
    }
    await expect(media.getByRole('status').filter({hasText:/^Saved privately\./})).toContainText('Saved privately');
    await expect(media.getByRole('figure').getByText('Private to this draft',{exact:true})).toBeVisible();
    await expect(media.getByAltText('Synthetic test logo')).toHaveCSS('object-fit','contain');
    expect(attachments).toBe(1);expect(initiations).toBe(1);expect(puts).toBe(isPng?2:1);
    await page.reload();await open(page,'Photos & logo');
    await expect(media.getByAltText('Synthetic test logo')).toBeVisible();
  });
}

test('oversized PNG logo is rejected before preview decoding or upload @short',async ({page})=>{
  await setup(page);let uploads=0;
  await page.route('**/api/v1/admin/media/uploads**',async route=>{uploads++;await route.fulfill({status:400,json:{error:{code:'invalid_request'}}});});
  await page.route(`**/api/v1/admin/shops/${id}/media**`,route=>route.fulfill({json:{entries:[]}}));
  await page.goto(`/admin/shops/${id}`);await open(page,'Photos & logo');
  const media=page.getByRole('region',{name:'Shop photos and logo'});
  await media.getByLabel('Choose a logo').setInputFiles({name:'oversized.png',mimeType:'image/png',buffer:makePng(9000,1)});
  await expect(media.getByRole('alert')).toContainText('8192 px');
  await expect(media.getByAltText('Selected logo for M6 Demo shop')).toHaveCount(0);
  expect(uploads).toBe(0);
});

test('D hours preserve existing data, validate and survive copy/save/reopen @short', async ({page},info)=>{
  const initial=fixture();
  initial.document.shop.opening_hours={note:'Call first\nHoliday times vary',entries:[
    {day:'monday',opens:'09:00',closes:'12:00',closed:false,note:'Morning'},
    {day:'monday',opens:'22:00',closes:'02:00',closed:null,note:'Late'},
    {day:'sunday',closed:true,note:'Closed for rest'},
    {day:'wednesday',closed:false,note:'Times to confirm'},
  ]};
  initial.document.shop.holiday_note='Synthetic holiday note';
  const originalSources=structuredClone(initial.document.sources), originalTypes=structuredClone(initial.document.types);
  const state=await setup(page,initial);
  await page.goto(`/admin/shops/${id}`); await open(page,'Visit details');
  await expect(page.getByText('Closes the following day.')).toBeVisible();
  await page.getByLabel('Opens',{exact:true}).first().fill('25:00');
  await page.getByLabel('Closes',{exact:true}).nth(1).fill('26:00'); await save(page);
  await expect(page.getByLabel('Opens',{exact:true}).first()).toBeFocused();
  await expect(page.getByLabel('Opens',{exact:true}).first()).toHaveAttribute('aria-invalid','true');
  await page.getByLabel('Opens',{exact:true}).first().fill('09:00');
  await expect(page.getByLabel('Opens',{exact:true}).first()).not.toHaveAttribute('aria-invalid');
  await expect(page.getByLabel('Closes',{exact:true}).nth(1)).toHaveAttribute('aria-invalid','true');
  await page.getByLabel('Closes',{exact:true}).nth(1).fill('02:00');
  await page.getByRole('button',{name:'Copy hours',exact:true}).click();
  await saveAndReview(page);
  const saved=state.current();
  expect(saved.document.shop.opening_hours).toEqual(expect.objectContaining({note:'Call first\nHoliday times vary'}));
  expect((saved.document.shop.opening_hours as {entries:{day:string}[]}).entries.map(r=>r.day)).toEqual(['monday','monday','tuesday','tuesday','wednesday','sunday']);
  expect(saved.document.sources).toEqual(originalSources);
  expect(saved.document.types).toEqual(originalTypes);
  expect(state.actions).toEqual(['save']); // invalid local input never submitted
  await expect(page.getByRole('heading',{name:'Saved public-page preview'})).toBeVisible();
  await expect(publicPreview(page).getByRole('article',{name:'Public page preview'}).getByText('22:00–02:00 (next day) · Late',{exact:true}).first()).toBeVisible();
  await expect(publicPreview(page).getByRole('article',{name:'Public page preview'}).getByText('Open · times not recorded · Times to confirm',{exact:true})).toBeVisible();
  await page.reload(); await open(page,'Visit details');
  await expect(page.getByLabel('Hours summary · optional')).toHaveValue('Call first\nHoliday times vary');
  await expect(page.getByLabel('Hours state')).toHaveCount(6);
  await expect(page.getByLabel('Hours note',{exact:true}).nth(1)).toHaveValue('Late');
  const scan=await new AxeBuilder({page}).include('main').analyze(); expect(scan.violations).toEqual([]);
  expect(await page.evaluate(()=>window.document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('admin-d-hours.png'),fullPage:true});
  page.once('dialog',d=>d.accept()); await page.getByRole('button',{name:'Clear all hours'}).click(); await save(page);
  await page.reload(); await open(page,'Visit details');
  expect(state.current().document.shop.opening_hours).toBeNull();
  await expect(page.getByLabel('Holiday note',{exact:true})).toHaveValue('Synthetic holiday note');
});

test('D preview excludes unsaved changes and failed-save comparison does not silently rebase @short',async({page})=>{
  const initial=fixture(); initial.publicationStatus='published';
  const state=await setup(page,initial);
  await page.goto(`/admin/shops/${id}`); await page.getByLabel('Shop name').fill('Unsaved synthetic name');
  await open(page,'Review');
  const preview=publicPreview(page).getByRole('article',{name:'Public page preview'});
  await expect(preview.getByRole('heading',{name:'M6 Demo shop',exact:true})).toBeVisible();
  await expect(preview.getByText('Unsaved synthetic name')).toHaveCount(0);
  await expect(page.getByText(/You have unsaved edits/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish saved changes'})).toBeDisabled();
  await open(page,'Shop & story'); state.conflict(); await save(page);
  await page.getByRole('button',{name:'Compare latest saved version'}).click();
  const comparison=page.getByRole('region',{name:'Compare with latest saved version'});
  await expect(comparison.getByText('Unsaved synthetic name',{exact:true})).toBeVisible();
  await expect(comparison.getByText('M6 Demo shop',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Shop name')).toHaveValue('Unsaved synthetic name');
  await save(page); // still uses the conflicted base: comparison cannot authorize overwriting
  await expect(page.getByRole('main').getByRole('alert')).toContainText('changed in another session');
  expect(state.current().document.shop.name).toBe('M6 Demo shop');
  expect(state.actions).toEqual(['save','save']);
});

test('D gallery stale caption preserves local text through refresh and deliberate retry @short',async({page})=>{
  await setup(page);
  const photo='85000000-0000-4000-8000-000000000001';
  let entry={id:photo,kind:'photo',width:2,height:2,altText:'Synthetic photo',creditText:null,status:'draft',revision:'a'.repeat(32),caption:'Original'};
  let fail=true; const requests:Record<string,unknown>[]=[];
  await page.route(`**/api/v1/admin/shops/${id}/media`,async route=>{
    if(route.request().method()==='POST') {
      const body=route.request().postDataJSON(); requests.push(body);
      if(fail) { fail=false;entry={...entry,caption:'Changed in another tab',revision:'b'.repeat(32)};await route.fulfill({status:409,json:{error:{code:'revision_conflict'}}});return; }
      expect(body.revisions).toEqual({[photo]:'b'.repeat(32)});
      entry={...entry,caption:body.captions[photo],revision:'c'.repeat(32)};
    }
    await route.fulfill({json:{entries:[entry],capabilities:['arrange','remove']}});
  });
  await page.route(`**/api/v1/admin/shops/${id}/media/${photo}`,r=>r.fulfill({contentType:'image/png',body:makePng()}));
  await page.goto(`/admin/shops/${id}`); await open(page,'Photos & logo');
  await page.getByLabel('Photo caption · optional').fill('My caption to keep');
  await page.getByRole('button',{name:'Save caption',exact:true}).click();
  await expect(page.getByLabel('Photo caption · optional')).toHaveValue('My caption to keep');
  await expect(page.getByText(/Saved caption: Changed in another tab/)).toBeVisible();
  await page.getByRole('button',{name:'Replace saved caption with my text'}).click();
  await expect(page.getByRole('button',{name:'Save caption',exact:true})).toBeDisabled();
  await page.reload(); await open(page,'Photos & logo');
  await expect(page.getByLabel('Photo caption · optional')).toHaveValue('My caption to keep');
  expect(requests.map(r=>r.action)).toEqual(['arrange','arrange']); expect(entry.status).toBe('draft');
});

test('D3 real viewport preview preserves public layout and excludes private media @short',async({page},info)=>{
  const initial=fixture();
  initial.revision='72000000-0000-4000-8000-000000000001';
  Object.assign(initial.document.shop,{field_note_body:'Synthetic saved story',address_line_1:'Synthetic address',internal_notes:'D3 PRIVATE NOTE',reference_links:'https://example.test/private'});
  const state=await setup(page,initial);
  const photo='85000000-0000-4000-8000-000000000001', privatePhoto='85000000-0000-4000-8000-000000000002',logo='85000000-0000-4000-8000-000000000003';
  const entries=[{id:photo,kind:'photo',width:2,height:2,altText:'Approved synthetic photo',creditText:null,caption:'Approved cover',status:'approved',revision:'a'.repeat(32)},{id:privatePhoto,kind:'photo',width:2,height:2,altText:'PRIVATE PHOTO',creditText:null,status:'draft',revision:'b'.repeat(32)},{id:logo,kind:'logo',width:2,height:2,altText:'Approved logo',creditText:null,status:'approved',revision:'c'.repeat(32)}];
  const writes:string[]=[];
  page.on('request',r=>{if(r.method()!=='GET') writes.push(r.url());});
  await page.route(`**/api/v1/admin/shops/${id}/media`,route=>route.fulfill({json:{entries}}));
  await page.route(`**/api/v1/admin/shops/${id}/media/*`,route=>route.fulfill({contentType:'image/png',body:makePng()}));
  await page.goto(`/admin/shops/${id}`); await open(page,'Review');
  const preview=publicPreview(page);
  await expect(preview.getByRole('heading',{name:'M6 Demo shop',exact:true})).toBeVisible();
  await expect(preview.getByText('Approved cover',{exact:true})).toBeVisible();
  await expect(preview.getByRole('button',{name:/Open photo 1 of 1/})).toBeVisible();
  await expect(preview.getByAltText('Approved logo')).toBeVisible();
  await expect(preview.locator('body')).not.toContainText('D3 PRIVATE NOTE');
  await expect(preview.locator('body')).not.toContainText('PRIVATE PHOTO');
  await expect(preview.locator('a[href="https://example.test/private"]')).toHaveCount(0);
  const body=preview.locator('[data-columns="two"]').last();
  expect(await body.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
  await page.getByRole('button',{name:'Mobile',exact:true}).click();
  await expect(page.getByRole('button',{name:'Mobile',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>body.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(1);
  expect(await preview.locator('html').evaluate(e=>e.scrollWidth <= e.clientWidth)).toBe(true);
  await preview.getByRole('button',{name:/Open photo 1 of 1/}).click();
  await expect(preview.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(preview.getByRole('dialog')).toHaveCount(0);
  await expect(preview.getByRole('button',{name:/Collect Stamp/})).toBeDisabled();
  await page.screenshot({path:info.outputPath('admin-d3-public-preview.png'),fullPage:true});
  expect(state.actions).toEqual([]); expect(writes).toEqual([]);
  expect(await page.evaluate(()=>window.document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('D3 preview refuses changed revisions and denied readers',async({page})=>{
  const state=await setup(page); await page.goto(`/admin/shops/${id}`); await open(page,'Review');
  await expect(publicPreview(page).getByRole('heading',{name:'M6 Demo shop',exact:true})).toBeVisible();
  const changed=state.current(); changed.revision='e'.repeat(32); changed.document.shop.name='Unreviewed change';
  await page.route(`**/api/v1/admin/shops/${id}`,route=>route.fulfill({json:changed}));
  await page.getByRole('button',{name:'Refresh preview',exact:true}).click();
  await expect(publicPreview(page).getByRole('main').getByRole('alert')).toContainText('This saved version has changed');
  await expect(publicPreview(page).getByText('Unreviewed change')).toHaveCount(0);
  await page.route(`**/api/v1/admin/shops/${id}`,route=>route.fulfill({status:403,json:{error:{code:'forbidden'}}}));
  await page.getByRole('button',{name:'Refresh preview',exact:true}).click();
  await expect(publicPreview(page).getByRole('main').getByRole('alert')).toContainText('current editor or admin access');
  expect(state.actions).toEqual([]);
});
