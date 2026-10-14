import { ReviewerModeProvider } from '@/src/features/reviewer/ReviewerModeProvider';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShopEditorial, ShopEditorialVisit } from './ShopEditorial';
import { ShopProvenance } from './ShopReviewerDetails';
import { prototypeShopDetails } from '@/src/fixtures/prototype-catalogue';

describe('editorial rendering', () => {
  it('preserves paragraphs and escapes user supplied text', () => {
    const { container } = render(<ShopEditorial content={{ field_note_heading: 'Field notes', field_note_body: 'First\n\n<script>private()</script>' }} />);
    expect(screen.getByText('First')).toBeVisible();
    expect(screen.getByText('<script>private()</script>')).toBeVisible();
    expect(container.querySelector('script')).toBeNull();
  });
  it('renders the selected icon and keeps the Writing icon for legacy entries', () => {
    const experience = {id:'one',category:'nib_testing',title:'Try nibs'};
    const {container,rerender}=render(<ShopEditorial content={{experiences:[experience]}}/>);
    const original=container.querySelector('svg')?.innerHTML;
    expect(original).toBeTruthy();
    rerender(<ShopEditorial content={{experiences:[{...experience,icon:'ink'}]}}/>);
    expect(container.querySelector('svg')?.innerHTML).not.toBe(original);
    expect(screen.getByRole('heading',{name:'Try nibs'})).toBeVisible();
  });
  it('omits unknown practical fields and shows known No in the private admin preview', () => {
    // The admin draft preview lists what an editor typed; the public page
    // resolves the same fields against the sourced blocks in shop-visit-facts.
    const { container, rerender } = render(<ShopEditorialVisit content={{}} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ShopEditorialVisit content={{ appointment_required: false }} />);
    expect(screen.getByText('No')).toBeVisible();
  });
  it('describes review honestly without inventing sources', () => {
    render(<ReviewerModeProvider><ShopProvenance shop={{ ...prototypeShopDetails[0]!, sources: [], review: { kind: 'editorial', reviewedAt: '2026-09-19T12:34:56Z' } }} /></ReviewerModeProvider>);
    expect(screen.getByText(/Listing reviewed by Nib Atlas on 19 September 2026/)).toHaveTextContent('not independent verification of every detail');
  });
});
