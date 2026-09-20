import { expect, test } from '@playwright/test';

for (const width of [360, 1440]) {
  test(`staging test venue renders honestly at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/shops/location-test-fairprice-compassvale-link');
    await expect(page.getByRole('heading', { level: 1, name: 'Location test — FairPrice Compassvale Link' })).toBeVisible();
    // The identity header states the place and the shop type on their own lines.
    await expect(page.getByText('Singapore', { exact: true })).toBeVisible();
    await expect(page.getByText('Staging test venue', { exact: true })).toBeVisible();
    await expect(page.getByText(/Not a fountain pen shop, partner or endorsement/)).toBeVisible();
    await expect(page.getByText(/demo fixture evidence/i)).toBeVisible();
    await expect(page.getByText('277C Compassvale Link, #01-13 Aspella, Singapore 543277')).toBeVisible();
    await expect(page.getByText('Photos coming soon')).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Photos of Location test — FairPrice Compassvale Link' }),
    ).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`phone-venue-${width}.png`), fullPage: true });
  });
}
