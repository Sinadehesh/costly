# Costly — brand assets

Sources are the SVGs here. The PNGs in `png/` are a build artifact
(gitignored) — regenerate them with:

```bash
node docs/brand/build.mjs      # needs playwright + any Chromium
```

## What to use where

| File | Use it for |
| --- | --- |
| `png/costly-title-slide-1920.png` | Drop-in 16:9 title slide, already composed |
| `png/costly-lockup-dark-2400.png` | Logo + wordmark on a dark slide |
| `png/costly-lockup-light-2400.png` | Same, on a white/light slide |
| `png/costly-lockup-transparent-*.png` | Over a photo or a coloured panel — pick the `white` file for dark backgrounds, `black` for light ones |
| `png/costly-icon-1024.png` | The app icon, square. Store listings, favicons, avatars |
| `png/costly-cat-white-2048.png` | The cat alone, transparent, for dark backgrounds |
| `png/costly-cat-black-2048.png` | The cat alone, transparent, for light backgrounds |
| `costly-icon.svg` | Anywhere vector is accepted — pure paths, no font dependency |

## Rules

- **The red is `#EF4444`** — the angry cat's card colour from inside the app.
  It is deliberately NOT the burn token `#FF3B2F`, which the design tokens
  reserve for the live meter. Don't swap them.
- **Never put the black cat on a dark background.** It is a silhouette; it
  disappears. Use the icon (which carries its own red field) or the white cat.
- **Don't recolour the cat.** Ink `#0A0A0A` or paper `#F2F4EF`, nothing else.
- **Don't stretch the lockup.** Scale it proportionally; the wordmark's
  letter-spacing is doing real work and distorts badly.
- **Give the icon room.** Clear space of at least 25% of its width on every
  side, or it reads as cramped next to slide text.

## Why the wordmark ships as a raster

SVG text depends on the viewer having the font, and slide software routinely
doesn't — a missing font silently substitutes and the mark stops being the
mark. So anything with letterforms is exported as PNG at 2× and the SVGs stay
pure geometry. The wordmark is set in a mono face with wide tracking, matching
the `COSTLY://TERMINAL` voice used throughout the product.
