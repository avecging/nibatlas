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

it('publishes the fixture only after the compatible Worker is deployed', () => {
  const workflow = readFileSync('.github/workflows/deploy-staging.yml', 'utf8');
  const publish = workflow.indexOf('run: bash scripts/publish-staging-phone-fixture.sh');
  expect(publish).toBeGreaterThan(workflow.indexOf('pnpm deploy:staging'));
  expect(publish).toBeLessThan(workflow.indexOf('pnpm exec playwright test --project=staging-catalogue'));
  expect(workflow.slice(0, workflow.indexOf('pnpm deploy:staging'))).not.toContain('staging-phone-location.sql');
});
