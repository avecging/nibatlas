# Milestone 1 visual evidence

Captured from a production build (`pnpm build && pnpm start`) on the branch that
introduced them, at `deviceScaleFactor: 1` so each image is exactly the review
viewport. Prefixes are the breakpoint: `m-` is 360 × 800, `t-` is 768 × 1024,
`d-` is 1440 × 900.

## 360 × 800 (primary mobile viewport)

| File | Shows |
| --- | --- |
| `m-map.png` | Map on first load: search, the result-scope switch, the intro card, clusters, and the sheet at **Peek** |
| `m-map-half.png` | Sheet at **Half** with filters and cards |
| `m-map-full.png` | Sheet at **Full** |
| `m-saved.png` | Global **Saved** mode: two saved shops in different countries, both on screen at once |
| `m-shop.png` | Shop detail first viewport (Pen House, Tainan) |
| `m-shop-omitted.png` | Shop detail where sources support less (SKB, Kaohsiung): no hours, no address, position marked locality-only |
| `m-ceremony.png` | Stamp ceremony mid-press |
| `m-ceremony-settled.png` | Ceremony settled, with place and date |
| `m-passport.png` | Passport closed |
| `m-passport-open.png` | Passport portrait single-page reader |
| `m-me.png` | Me |

## 768 × 1024

| File | Shows |
| --- | --- |
| `t-map.png` | Map with the sheet at Peek |
| `t-map-full.png` | Map with the sheet at Full |
| `t-passport.png` | Passport closed |
| `t-passport-open.png` | Passport portrait single-page reader |

## 1440 × 900

| File | Shows |
| --- | --- |
| `d-map.png` | Desktop map/list split |
| `d-saved.png` | Global Saved mode on the split |
| `d-passport-closed.png` | Closed passport at a three-quarter angle |
| `d-passport-opening.png` | Cover mid-swing, hinged on the spine |
| `d-passport-open.png` | Complete two-page spread with a fixed gutter |
| `d-passport-forward.png` | Forward turn in flight: the right leaf moving to the left stack |
| `d-passport-reverse.png` | Reverse turn in flight: the left leaf returning to the right stack |
| `d-shop.png` | Shop detail |
| `d-me.png` | Me |
| `d-styleguide.png` | Tokens, the eight stamp inks, the mark, controls, markers, stamp tiers and motifs |

## Reduced motion

| File | Shows |
| --- | --- |
| `m-ceremony-reduced.png` | Collection with `prefers-reduced-motion`: the completed impression, no press |
| `m-passport-reduced.png` | Portrait page change with reduced motion: content already changed, no leaf in flight |
| `d-passport-reduced.png` | Spread page change with reduced motion |
