import { expect, test, type Page } from '@playwright/test';
import { ISSUED_STAMP, STAMP_OWNER } from '../../src/test/stamp';

// Synthetic account data: fixture-mode tests do not render the progress panel.
const seal = {
  id: '30000000-0000-4000-8000-000000000001', published: true,
  current: {
    scope: 'country', countryCode: 'JP', countryLabel: 'Japan',
    localityId: null, localitySlug: null, localityName: null,
    ink: 'teal', template: 'cartouche-v2',
    eligibleShopIds: [ISSUED_STAMP.shopId],
    eligibleShops: [{ id: ISSUED_STAMP.shopId, name: ISSUED_STAMP.shopName }],
  },
  progress: { count: 1, collectedIds: [ISSUED_STAMP.shopId], required: 1, eligibleTotal: 1 },
  award: null,
};

async function account(page: Page, seals: 'ready' | 'empty' | 'error' = 'ready') {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: {
    status: 'signed-in', userId: STAMP_OWNER, identityLabel: 'fixture@example.test', displayName: null,
  } }));
  await page.route('**/api/v1/saved-shops', route => route.fulfill({ json: { savedShopIds: [], shops: [] } }));
  await page.route('**/api/v1/saved-shops/pending', route => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/collections*', route => route.fulfill({ json: {
    ownerId: STAMP_OWNER, collections: [ISSUED_STAMP], nextCursor: null,
  } }));
  await page.route('**/api/v1/seals', route => route.fulfill(seals === 'error'
    ? { status: 503, json: {} }
    : { json: { ownerId: STAMP_OWNER, rows: seals === 'empty' ? [] : [seal], nextCursor: null } }));
}

async function expectBookFits(page: Page) {
  const book = page.locator('[data-mode][data-opened]');
  const pager = page.getByRole('group', { name: 'Passport pages' });
  await expect(book).toBeInViewport({ ratio: 1 });
  await expect(pager).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('group', { name: 'Passport view' })).toBeInViewport({ ratio: 1 });
  await expect.poll(async () => {
    const bookBox = await book.boundingBox();
    const pagerBox = await pager.boundingBox();
    return bookBox!.y + bookBox!.height <= pagerBox!.y;
  }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    await page.evaluate(() => document.documentElement.clientHeight),
  );
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
 for (const viewport of [{ width: 360, height: 568 }, { width: 393, height: 700 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`account book fits with collapsed and expanded seals at ${viewport.width}x${viewport.height} (${reducedMotion})`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion });
    await account(page);
    await page.goto('/passport/jp/tokyo');
    await page.getByRole('button', { name: 'Book', exact: true }).click();
    await expect(page.locator('summary').filter({ hasText: 'Geographic seals' })).toBeVisible();
    await expectBookFits(page);
    await page.screenshot({ path: info.outputPath('passport-collapsed.png') });
    await page.locator('summary').filter({ hasText: 'Geographic seals' }).click();
    await expectBookFits(page);
    await page.screenshot({ path: info.outputPath('passport-expanded.png') });
    await page.locator('summary').filter({ hasText: 'Geographic seals' }).click();
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    await expectBookFits(page);
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.locator('[class*="turner"]')).toHaveCount(0);
    await expectBookFits(page);
    await page.getByRole('button', { name: 'Cover', exact: true }).click();
    await expect(page.locator('[data-mode][data-opened]')).toHaveAttribute('data-opened', 'false');
    await expect(page.locator('[class*="coverFace"][data-face="front"]')).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Open Passport', exact: true }).click();
    await expectBookFits(page);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByRole('button', { name: /Historical Demo Shop/ })).toBeVisible();
  });
 }
}

for (const seals of ['empty', 'error'] as const) {
  test(`account book fits when seal progress is ${seals}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 568 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await account(page, seals);
    await page.goto('/passport/jp/tokyo');
    await page.getByRole('button', { name: 'Book', exact: true }).click();
    if (seals === 'error') await expect(page.getByRole('status')).toContainText('Seals could not refresh');
    await expectBookFits(page);
  });
}
