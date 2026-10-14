import {test as base, type Page} from '@playwright/test';

function accessHeaders(): Record<string, string> {
  const id = process.env.CF_ACCESS_CLIENT_ID, secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!id && !secret) return {};
  if (!id || !secret) throw Error('Both staging Access credentials are required');
  return {'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret};
}

export function stagingRequestOptions(path: string) {
  if (!path.startsWith('/') || path.startsWith('//')) throw Error('Staging requests must use a relative path');
  // Credentials go only to the staging origin; an Access login redirect fails
  // the smoke rather than forwarding the service token to another provider.
  return {headers: accessHeaders(), maxRedirects: 0};
}

export async function authorizeStagingPage(page: Page, origin: string, headers: Record<string, string>) {
  await page.route('**/*', async route => {
        if (new URL(route.request().url()).origin !== origin) return route.continue();
        // Do not set global browser headers: that would leak Access credentials
        // to MapTiler and other external resources. Fulfil redirects without
        // following them, so a subsequent browser request gets its own routing.
        const response = await route.fetch({headers: {...route.request().headers(), ...headers}, maxRedirects: 0});
        await route.fulfill({response});
  });
}

export const test = base.extend({
  page: async ({page}, providePage) => {
    const headers = accessHeaders();
    if (Object.keys(headers).length) await authorizeStagingPage(page, new URL(process.env.STAGING_URL!).origin, headers);
    await providePage(page);
  },
});
