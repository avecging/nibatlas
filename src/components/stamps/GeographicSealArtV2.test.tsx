import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { StampArt } from './StampArt';
import { sealDesign, type SealDocument } from '@/src/domain/geographic-seals';

afterEach(cleanup);
const doc: SealDocument = {scope:'country',countryCode:'BA',countryLabel:'Bosnia and Herzegovina',localityId:null,ink:'teal',eligibleShopIds:[],template:'cartouche-v2'};

it('uses the approved country frame and preserves the name and verification labels', () => {
  const {container} = render(<StampArt stamp={sealDesign('test',doc)} title={doc.countryLabel} subtitle="2 October 2026" />);
  expect(screen.getByRole('img',{name:/Country seal, Bosnia and Herzegovina/})).toHaveAttribute('data-seal-template','cartouche-v2');
  expect(screen.getByText('COUNTRY').tagName.toLowerCase()).toBe('textpath');
  expect(screen.getByText('NIB ATLAS').tagName.toLowerCase()).toBe('textpath');
  expect(screen.getByText('VERIFIED VISITS')).toBeInTheDocument();
  expect(container.querySelector('image')).toHaveAttribute('href','/stamps/cartouche-v2-country.svg');
  expect(screen.getByText('2 October 2026').tagName.toLowerCase()).toBe('figcaption');
});
it('uses the simpler locality frame, country context and unique masks for repeated impressions', () => {
  const stamp = sealDesign('test',{...doc,scope:'locality',localityId:'locality'},1,'Sarajevo');
  const {container} = render(<><StampArt stamp={stamp} title="Sarajevo" /><StampArt stamp={stamp} title="Sarajevo" /></>);
  expect(screen.getAllByText('LOCALITY')).toHaveLength(2);
  expect(screen.getAllByText('BOSNIA AND HERZEGOVINA')).toHaveLength(2);
  expect(container.querySelector('image')).toHaveAttribute('href','/stamps/cartouche-v2-locality.svg');
  const ids = [...container.querySelectorAll('[id]')].map(node=>node.id);
  expect(new Set(ids).size).toBe(ids.length);
});
it('keeps legacy generated designs and custom artwork on their existing render paths', () => {
  const {rerender,container} = render(<StampArt stamp={sealDesign('old',{...doc,template:'cartouche-v1'})} title="Original" />);
  expect(container.querySelector('[data-seal-template]')).toBeNull();
  rerender(<StampArt stamp={sealDesign('custom',{...doc,artworkId:'retained',artworkTreatment:'ink-v1'})} title="Custom" />);
  expect(screen.getByRole('img')).toHaveAttribute('src','/api/v1/seals/artwork/retained?ink=teal');
});

it('keeps long single-word countries unbroken and smaller than short names', () => {
  const {container,rerender} = render(<StampArt stamp={sealDesign('test',doc)} title="Liechtenstein" />);
  const long = screen.getByText('LIECHTENSTEIN');
  expect(long.tagName.toLowerCase()).toBe('tspan');
  expect(long.parentElement?.querySelectorAll('tspan')).toHaveLength(1);
  const longSize = Number(long.parentElement?.getAttribute('font-size'));
  expect(Number(long.getAttribute('textLength'))).toBeLessThanOrEqual(1000);
  rerender(<StampArt stamp={sealDesign('test',doc)} title="Japan" />);
  expect(Number(screen.getByText('JAPAN').parentElement?.getAttribute('font-size'))).toBeGreaterThan(longSize);
  expect(container.querySelector('textPath')).toBeInTheDocument();
});
