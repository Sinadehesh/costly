/**
 * Renders the presentation-ready PNGs from the SVG sources in this folder.
 *
 *   node docs/brand/build.mjs
 *
 * Needs playwright (`npm i playwright`) and any Chromium. Outputs land in
 * docs/brand/png/ and are gitignored — the SVGs are the source of truth, the
 * PNGs are a build artifact. Text is baked into the lockups on purpose: SVG
 * text depends on the viewer having the font, which slide decks routinely
 * don't, so anything with a wordmark ships as a raster.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'png');
mkdirSync(OUT, { recursive: true });

const strip = (f) => readFileSync(join(HERE, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
const ICON = strip('costly-icon.svg');
const MARK_LIGHT = strip('costly-mark-light.svg');

const RED = '#EF4444';
const INK = '#0B0D0A';
const PAPER = '#F2F4EF';

/** Wordmark set wide and monospaced — the app's terminal voice, as a logo. */
const wordmark = (color, size) => `
  <div style="
    font-family: 'DejaVu Sans Mono', ui-monospace, monospace;
    font-weight: 700; font-size: ${size}px; letter-spacing: 0.14em;
    color: ${color}; line-height: 1;">COSTLY</div>`;

const tagline = (color, size) => `
  <div style="
    font-family: 'DejaVu Sans', system-ui, sans-serif; font-size: ${size}px;
    color: ${color}; letter-spacing: 0.01em; margin-top: ${size * 0.7}px;">
    doomscrolling with a price tag</div>`;

function page(body, { bg = 'transparent', w, h }) {
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:${bg};}
    body{width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;}
    svg{display:block;}
  </style><body>${body}</body>`;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

async function shot(name, html, { w, h, transparent = false, scale = 1 }) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(150);
  await p.screenshot({ path: join(OUT, name), omitBackground: transparent });
  await p.close();
  console.log('→', name, `${w * scale}×${h * scale}`);
}

// ── App icon, square ────────────────────────────────────────────────────────
const iconAt = (px) => ICON.replace(/width="\d+"/, `width="${px}"`).replace(/height="\d+"/, `height="${px}"`);

await shot('costly-icon-1024.png', page(iconAt(512), { w: 512, h: 512 }), {
  w: 512, h: 512, transparent: true, scale: 2,
});

// ── The cat alone, transparent — for placing on any slide colour ────────────
const markAt = (px) =>
  MARK_LIGHT.replace(/width="\d+"/, `width="${px}"`).replace(/height="\d+"/, `height="${Math.round(px * 0.72)}"`);

await shot('costly-cat-white-2048.png', page(markAt(1024), { w: 1024, h: 760 }), {
  w: 1024, h: 760, transparent: true, scale: 2,
});
await shot(
  'costly-cat-black-2048.png',
  page(strip('costly-mark.svg').replace(/width="\d+"/, 'width="1024"').replace(/height="\d+"/, 'height="737"'),
    { w: 1024, h: 760 }),
  { w: 1024, h: 760, transparent: true, scale: 2 },
);

// ── Horizontal lockups: icon + wordmark ─────────────────────────────────────
function lockup(color, withTagline) {
  return `<div style="display:flex;align-items:center;gap:56px;">
    ${iconAt(220)}
    <div>${wordmark(color, 130)}${withTagline ? tagline(color === PAPER ? '#98A090' : '#55604f', 34) : ''}</div>
  </div>`;
}

for (const [name, color, bg] of [
  ['costly-lockup-dark', PAPER, INK],
  ['costly-lockup-light', INK, PAPER],
  ['costly-lockup-transparent-white', PAPER, 'transparent'],
  ['costly-lockup-transparent-black', INK, 'transparent'],
]) {
  await shot(
    `${name}-2400.png`,
    page(lockup(color, true), { bg, w: 1200, h: 420 }),
    { w: 1200, h: 420, transparent: bg === 'transparent', scale: 2 },
  );
}

// ── Title slide, 16:9 — drop straight into a deck ───────────────────────────
await shot(
  'costly-title-slide-1920.png',
  page(
    `<div style="display:flex;flex-direction:column;align-items:center;gap:44px;">
       ${iconAt(260)}
       <div style="text-align:center;">
         ${wordmark(PAPER, 148)}
         <div style="font-family:'DejaVu Sans',system-ui,sans-serif;font-size:40px;color:${RED};
                     margin-top:26px;letter-spacing:0.01em;">doomscrolling with a price tag</div>
       </div>
     </div>`,
    { bg: INK, w: 1920, h: 1080 },
  ),
  { w: 1920, h: 1080, scale: 1 },
);

await browser.close();
console.log('\nAll assets in docs/brand/png/');
