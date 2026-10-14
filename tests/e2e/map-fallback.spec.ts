import { expect, test } from '@playwright/test';

test('WebGL initialization failure preserves shop results and navigation', async ({page}, info) => {
  // Exercise the actual locked MapLibre constructor's partial-return path.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const dismiss = page.getByRole('button', {name: 'Dismiss introduction'});
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByText('Map unavailable', {exact: true})).toBeVisible();
  await expect(page.getByRole('list', {name: /shops in the searched area/i})).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('Something went wrong');
  expect(errors).toEqual([]);
  await page.screenshot({path: info.outputPath('map-webgl-fallback.png'), fullPage: true});
  await page.getByRole('link', {name: 'Me', exact: true}).first().click();
  await expect(page).toHaveURL(/\/me$/);
});
