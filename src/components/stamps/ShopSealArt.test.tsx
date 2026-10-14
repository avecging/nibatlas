import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { StampArt } from './StampArt';
import { SHOP_SEAL_SHAPES } from '@/src/domain/shop-seal';
import type { ShopStampDesign } from '@/src/domain/shop-detail';

afterEach(cleanup);
const stamp:ShopStampDesign={id:'fixture',tier:'shop',motif:'nib',ink:'teal',designVersion:2,paletteVersion:1,localityLabel:'Singapore',countryLabel:'Singapore'};
it.each(SHOP_SEAL_SHAPES)('renders the approved %s design with saved content', shape => {
  const {container}=render(<StampArt stamp={{...stamp,generatedShopSeal:shape}} title="THINK FUNAN" subtitle="3 October 2026"/>);
  expect(screen.getByRole('img')).toHaveAttribute('data-shop-seal-shape',shape);
  for(const label of ['SHOP','NIB ATLAS','THINK FUNAN','SINGAPORE','VERIFIED VISITS','3 October 2026']) expect(screen.getByText(label)).toBeInTheDocument();
  expect(container.querySelector('image')).toBeNull();
});
it('keeps long names within two lines and separates repeated SVG references',()=>{
  const {container}=render(<>{['NAGASAWA STATIONERY CENTER MAIN STORE','銀座伊東屋本店','W'.repeat(300)].map(title=>
    <StampArt key={title} stamp={{...stamp,generatedShopSeal:'oval'}} title={title}/>)}</>);
  for(const svg of container.querySelectorAll('svg[data-shop-seal-shape]')){
    expect(svg.querySelectorAll('tspan').length).toBeLessThanOrEqual(2);
    for(const span of svg.querySelectorAll('tspan')) expect(Number(span.getAttribute('textLength'))).toBeLessThanOrEqual(475);
  }
  const ids=[...container.querySelectorAll('[id]')].map(node=>node.id); expect(new Set(ids).size).toBe(ids.length);
});
it('does not redraw legacy or uploaded impressions',()=>{
  const {container,rerender}=render(<StampArt stamp={stamp} title="Legacy"/>);
  expect(container.querySelector('[data-shop-seal-template]')).toBeNull();
  rerender(<StampArt stamp={{...stamp,generatedShopSeal:'shield',uploaded:{origin:'founder_created',transparentPngSha256:'a'.repeat(64)}}} title="Custom"/>);
  expect(screen.getByRole('img')).toHaveAttribute('src','/api/v1/stamps/fixture/artwork/2');
});
