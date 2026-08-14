#!/usr/bin/env node
/* =============================================================================
   Derive every raster brand asset from src/brand/artwork.js
   -----------------------------------------------------------------------------
   Run:  npm run brand
   Writes: public/icons/*.png, public/splash/*.png, public/icon.svg, public/favicon.svg

   WHY a build step instead of committing hand-made images: iOS requires PNG for
   apple-touch-icon and apple-touch-startup-image, so vector alone is impossible.
   Generating them keeps one source of truth — change the curve in artwork.js and
   all 60-odd files regenerate consistently.

   WHY the output is committed rather than generated during `npm run build`:
   `resvg` is a native devDependency, and a Netlify build should not need it (nor
   should a deploy be able to fail on an icon). The assets are static; they only
   change when the brand does.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { appIconSvg, faviconSvg, splashSvg } = require('../src/brand/artwork');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const ICONS = path.join(PUBLIC, 'icons');
const SPLASH = path.join(PUBLIC, 'splash');

const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });
const render = (svg, width) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } })
    .render()
    .asPng();

let count = 0;
let bytes = 0;
const write = (file, buf) => {
  fs.writeFileSync(file, buf);
  count += 1;
  bytes += buf.length;
};

/* ------------------------------------------------------------------- icons ---
   Sizes and why each exists:
     180  apple-touch-icon for @3x iPhone — the one iOS actually uses for Home
          Screen web clips on every current phone.
     167  iPad Pro.   152  iPad / iPad mini.   120  older @2x iPhone.
     192  the Android/Chrome manifest baseline.
     512  manifest large icon; also what installers use for the app list.
     1024 master, kept so a future size never has to be upscaled.
     32/16 favicon rasters for browsers that ignore SVG favicons.
   ---------------------------------------------------------------------------- */
const iconSvg = appIconSvg();
const maskableSvg = appIconSvg({ maskable: true });
const roundedSvg = appIconSvg({ rounded: true });

ensure(ICONS);
[1024, 512, 192, 180, 167, 152, 120].forEach((size) =>
  write(path.join(ICONS, `icon-${size}.png`), render(iconSvg, size))
);
// Maskable: Android may crop to a circle, so the mark is scaled in.
[512, 192].forEach((size) =>
  write(path.join(ICONS, `maskable-${size}.png`), render(maskableSvg, size))
);
// Favicons are rounded: a browser tab applies no mask.
[32, 16].forEach((size) =>
  write(path.join(PUBLIC, `favicon-${size}.png`), render(roundedSvg, size))
);

// Vector copies. Served to anything that prefers SVG (desktop tabs, Android
// adaptive), and they are the human-readable record of what the PNGs contain.
write(path.join(PUBLIC, 'icon.svg'), Buffer.from(iconSvg, 'utf8'));
write(path.join(PUBLIC, 'favicon.svg'), Buffer.from(faviconSvg(), 'utf8'));

/* ------------------------------------------------------------------ splash ---
   apple-touch-startup-image is matched by an exact media query, so every device
   needs its own file at its own pixel size. The list below is every iPhone and
   iPad currently running a supported iOS, keyed by CSS px + DPR.

   iPhone is portrait only, on purpose: the manifest declares
   "orientation": "portrait", the tab dock caps at 420px, and this is a
   phone-held-one-handed ERP. Generating 12 landscape phone images for an
   orientation the app does not adopt is dead weight in the repo.

   iPad gets both orientations because iPadOS will not honour an orientation
   lock for a Home Screen web app.

   Each entry is also generated in light and dark, matched with
   (prefers-color-scheme) in the <link media>, because a light launch image
   followed by a dark first paint is a white flash in a dark room.
   ---------------------------------------------------------------------------- */
const IPHONE = [
  { w: 320, h: 568, r: 2, name: 'iPhone SE (1st gen), 5s' },
  { w: 375, h: 667, r: 2, name: 'iPhone SE (2nd/3rd gen), 8, 7, 6s' },
  { w: 414, h: 736, r: 3, name: 'iPhone 8 Plus, 7 Plus, 6s Plus' },
  { w: 375, h: 812, r: 3, name: 'iPhone 13 mini, 12 mini, 11 Pro, XS, X' },
  { w: 414, h: 896, r: 2, name: 'iPhone 11, XR' },
  { w: 414, h: 896, r: 3, name: 'iPhone 11 Pro Max, XS Max' },
  { w: 390, h: 844, r: 3, name: 'iPhone 14, 13, 13 Pro, 12, 12 Pro' },
  { w: 428, h: 926, r: 3, name: 'iPhone 14 Plus, 13 Pro Max, 12 Pro Max' },
  { w: 393, h: 852, r: 3, name: 'iPhone 16, 15, 15 Pro, 14 Pro, 16e' },
  { w: 430, h: 932, r: 3, name: 'iPhone 16 Plus, 15 Plus, 15 Pro Max, 14 Pro Max' },
  { w: 402, h: 874, r: 3, name: 'iPhone 16 Pro' },
  { w: 440, h: 956, r: 3, name: 'iPhone 16 Pro Max' }
];

const IPAD = [
  { w: 768, h: 1024, r: 2, name: 'iPad 9.7", mini 4/5, Air 2' },
  { w: 810, h: 1080, r: 2, name: 'iPad 10.2"' },
  { w: 820, h: 1180, r: 2, name: 'iPad Air 10.9"' },
  { w: 744, h: 1133, r: 2, name: 'iPad mini 6/7' },
  { w: 834, h: 1112, r: 2, name: 'iPad Pro 10.5"' },
  { w: 834, h: 1194, r: 2, name: 'iPad Pro 11"' },
  { w: 1024, h: 1366, r: 2, name: 'iPad Pro 12.9"' },
  { w: 1032, h: 1376, r: 2, name: 'iPad Pro 13" (M4)' }
];

ensure(SPLASH);

/** One startup image. `orientation` swaps the CSS box, not the artwork. */
const splashFile = ({ w, h, r, scheme, orientation }) => {
  const cssW = orientation === 'landscape' ? h : w;
  const cssH = orientation === 'landscape' ? w : h;
  const svg = splashSvg({ width: cssW, height: cssH, scheme });
  const px = cssW * r;
  const file = `splash-${cssW}x${cssH}@${r}x-${scheme}.png`;
  write(path.join(SPLASH, file), render(svg, px));
  return { file, cssW, cssH, r, scheme, orientation };
};

const entries = [];
['light', 'dark'].forEach((scheme) => {
  IPHONE.forEach((d) => entries.push(splashFile({ ...d, scheme, orientation: 'portrait' })));
  IPAD.forEach((d) => {
    entries.push(splashFile({ ...d, scheme, orientation: 'portrait' }));
    entries.push(splashFile({ ...d, scheme, orientation: 'landscape' }));
  });
});

/* Emit the <link> tags. Hand-maintaining 40 media queries is how they end up
   subtly wrong, so index.html gets a generated block written into it between
   two markers — the HTML stays readable and reviewable, but the numbers come
   from the same table that produced the images. */
const linkTags = entries
  .map(({ file, cssW, cssH, r, scheme, orientation }) => {
    const media = [
      scheme === 'dark' ? '(prefers-color-scheme: dark)' : '(prefers-color-scheme: light)',
      `(device-width: ${cssW}px)`,
      `(device-height: ${cssH}px)`,
      `(-webkit-device-pixel-ratio: ${r})`,
      `(orientation: ${orientation})`
    ].join(' and ');
    return `    <link rel="apple-touch-startup-image" media="${media}" href="%PUBLIC_URL%/splash/${file}" />`;
  })
  .join('\n');

const INDEX = path.join(PUBLIC, 'index.html');
const START = '<!-- BRAND:SPLASH:START (generated by npm run brand — do not edit by hand) -->';
const END = '<!-- BRAND:SPLASH:END -->';
let html = fs.readFileSync(INDEX, 'utf8');
if (html.includes(START) && html.includes(END)) {
  const before = html.slice(0, html.indexOf(START) + START.length);
  const after = html.slice(html.indexOf(END));
  html = `${before}\n${linkTags}\n${after}`;
  fs.writeFileSync(INDEX, html);
  console.log(`  index.html splash block updated (${entries.length} links)`);
} else {
  console.warn(`  ! ${START} markers not found in public/index.html — links not injected`);
}

console.log(`\n${count} files, ${(bytes / 1024 / 1024).toFixed(2)} MB total`);
console.log(`  icons:  public/icons/  (+ favicon-16/32.png, icon.svg, favicon.svg)`);
console.log(`  splash: public/splash/ (${entries.length} images, light + dark)`);
