import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { projectStampDesign } from '@/src/features/shops/shop-detail-projection';

it('keeps the staging venue preview and issued artwork aligned', () => {
  const fixture = readFileSync('supabase/fixtures/staging-phone-location.sql', 'utf8');
  const template = JSON.parse(fixture.match(/'({"tier":"shop","motif":"[a-z-]+"})'/)?.[1] ?? '{}');
  const ink = fixture.match(/\n  '([a-z]+)', 1, '2026-09-12/)?.[1];
  const design = projectStampDesign({ slug: 'location-test-fairprice-compassvale-link', localityName: 'Singapore', countryCode: 'SG' });
  expect(template).toEqual({ tier: design.tier, motif: design.motif });
  expect(ink).toBe(design.ink);
});
