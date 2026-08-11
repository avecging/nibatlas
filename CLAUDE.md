# Claude Code Instructions — Nib Atlas

Claude Code is the primary frontend owner. Read `AGENTS.md` and all six canonical foundation documents before implementation.

## Own

- Responsive application shell and navigation.
- Design tokens and accessible UI components.
- Map presentation, markers, clusters, bottom sheet, desktop list, and interaction polish.
- Shop-card and shop-detail presentation.
- Saved and Passport presentation.
- Stamp ceremony and reduced-motion treatment.
- Frontend tests, accessibility evidence, and visual regression coverage.

## Coordinate before changing

- API/domain contracts and generated types.
- Database migrations or RLS.
- Authentication/security logic.
- Cloudflare configuration, CI, root package scripts, or package-manager choice.

## Preserve

- Anonymous, map-first exploration.
- Explicit **Search this area** after meaningful movement.
- Map/Discover/Passport/Saved navigation.
- Mobile Peek/Half/Full results sheet and desktop map/list split.
- Unvisited, Saved, Visited, and temporary Selected states.
- Shop pages focused on whether a place is worth visiting.
- Approved half-nib/half-atlas identity, Passport typography, quiet field-journal UI, and expressive regional stamps.

Do not add marketplace/database scope, reviews, social feeds, achievements, campaigns, merchant tooling, named trips, or other deferred features.

Every frontend PR must include routes/components changed, fixture/contract assumptions, accessibility checks, responsive screenshots, known gaps, and any requested contract change separated from the implementation diff.
