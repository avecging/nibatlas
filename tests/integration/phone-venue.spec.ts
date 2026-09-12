import { expect, test } from '@playwright/test';

for (const width of [360, 1440]) {
  test(`staging test venue renders honestly at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/shops/location-test-fairprice-compassvale-link');
    await expect(page.getByRole('heading', { level: 1, name: 'Location test — FairPrice Compassvale Link' })).toBeVisible();
    await expect(page.getByText('Singapore · Staging test venue', { exact: true })).toBeVisible();
    await expect(page.getByText(/Not a fountain pen shop, partner or endorsement/)).toBeVisible();
    await expect(page.getByText(/demo fixture evidence/i)).toBeVisible();
    await expect(page.getByText('277C Compassvale Link, #01-13 Aspella, Singapore 543277')).toBeVisible();
    await expect(page.getByText('Photos coming soon')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`phone-venue-${width}.png`), fullPage: true });
  });
}
