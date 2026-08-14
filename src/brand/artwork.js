/* =============================================================================
   Suhel Roadlines — brand artwork, as geometry
   =============================================================================

   WHY THIS FILE EXISTS
   iOS will not accept SVG for `apple-touch-icon` or `apple-touch-startup-image`
   — both must be raster PNG (Apple, "Configuring Web Applications":
   https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
   — "place an icon file in PNG format"). So we cannot ship vector only.

   The answer is not to hand-draw PNGs. It is to keep ONE vector definition and
   *derive* every raster from it at build time (`scripts/generate-brand-assets.js`).
   That means the icon, the favicon, the launch screens and the in-app mark can
   never drift apart, because there is only one set of coordinates.

   This module is deliberately CommonJS and framework-free: the Node generator
   `require`s it, and webpack imports it for the React mark. One source, two
   consumers, no duplicated path data.

   ---------------------------------------------------------------------------
   THE MARK — what it is and why
   ---------------------------------------------------------------------------
   A road in one-point perspective, running from the bottom of the frame to a
   vanishing point, with a sun on the horizon.

   *Why this and not a monogram?* Apple's HIG guidance on app icons is to use a
   single simple subject and to avoid text: text does not localise, and two
   letters at the real render size (60x60pt on the Home Screen) are a smear.
   A road is the literal subject of the business — "Roadlines" — and it is
   recognisable as a silhouette.

   *Why is it needed?* The app currently ships Create React App's React logo.
   An icon is the one piece of this app the user sees when they are NOT using
   it; a stock framework logo on the Home Screen says "this is a web page".

   *Why these shapes?* Everything here survives being drawn 30 pixels wide:
   one large white wedge, one amber disc. The centreline dashes are cut out of
   the wedge as negative space rather than drawn on top, so they are always
   exactly the plate colour and they resolve as detail at large sizes instead of
   muddying small ones. Nothing depends on a stroke width, so there is no
   hairline to disappear.

   *Why these colours?* Taken from the existing token layer rather than
   invented: the plate is the brand navy (`--brand-gradient`, #14386F -> #0A2450)
   and the sun is `--sys-orange` (#FF9500), which is also the hue of the warm
   wash at the top of every screen (`AppLayout.css`). So the icon, the launch
   screen and the app's first paint are the same three colours in the same
   order, and launching reads as one continuous movement instead of three
   unrelated images. The navy is opened up slightly at the top of the ramp
   (#1E4E8C) because an icon sits on an unknown wallpaper at 60pt and needs more
   internal contrast than a 34px avatar on a white nav bar does.

   *What does it cost?* Nothing at runtime. Pure geometry, no gradients meshes,
   no filters, no embedded raster. The generated PNGs are flat gradients and
   two solid shapes, which is why they compress to a few KB each.

   ---------------------------------------------------------------------------
   COORDINATE SYSTEM
   ---------------------------------------------------------------------------
   1024x1024, Apple's master icon size, so every downscale is an integer-ish
   ratio of the source. The artwork is full-bleed: it deliberately does NOT
   round its own corners, because iOS applies the icon mask itself and a
   pre-rounded icon produces a visible double corner.
   ========================================================================== */

/* ------------------------------------------------------------------ palette */

const COLOR = {
  // Plate: the brand navy ramp. Bottom stop is the token value verbatim.
  plateTop: '#1E4E8C',
  plateBottom: '#0A2450',
  // Sun: --sys-orange, with a lighter stop so the disc has a light direction
  // consistent with the plate's own top-lit ramp.
  sunTop: '#FFBC57',
  sunBottom: '#FF9500',
  road: '#FFFFFF',

  // Launch-screen backgrounds. These mirror `.app-shell::before` in
  // AppLayout.css exactly — same hex, same px offsets — so the launch image and
  // the app's first painted frame are indistinguishable.
  splashLight: [
    [0, '#FBE1CB'],
    [120, '#FDEEE1'],
    [300, '#F5F6F6'],
    [440, '#F2F2F7']
  ],
  splashDark: [
    [0, '#2A1D14'],
    [130, '#1C1712'],
    [320, '#0B0B0C'],
    [440, '#000000']
  ],
  splashLightBase: '#F2F2F7', // --bg-grouped, light
  splashDarkBase: '#000000' //  --bg-grouped, dark
};

/* ---------------------------------------------------------------- geometry */

/* The road, as a closed outline.

   Built from four vertices — bottom-left (232,780), top-left (485,390),
   top-right (539,390), bottom-right (792,780) — with the corners filleted by a
   quadratic whose control point IS the original vertex. That gives a true
   tangent-continuous fillet without solving any tangent-length trigonometry,
   and it is why these numbers look arbitrary: they are the vertices offset
   along each edge by the fillet length (34 at the near corners, 10 at the far
   pair, because a fillet must scale with the perspective or the far end looks
   blunt).

   The vanishing point is directly above centre at x=512, so the wedge is
   symmetrical and the sun can sit on the same axis. */
const ROAD_PATH = [
  'M250.5 751.47',
  'L479.56 398.39',
  'Q485 390 495 390',
  'L529 390',
  'Q539 390 544.44 398.39',
  'L773.5 751.47',
  'Q792 780 758 780',
  'L266 780',
  'Q232 780 250.5 751.47',
  'Z'
].join(' ');

/* Centreline dashes, as cut-outs.

   Each is a trapezoid whose width tracks the road's own width at that depth:
   half-width(y) = 27 + 253 * (y - 390) / 390, and each dash is 10% of that. So
   the dashes foreshorten at exactly the same rate as the road edges, which is
   what makes the perspective read as correct rather than approximate.

   The nearest dash runs off the bottom of the frame on purpose — a dash that
   stopped short would put a hard horizontal edge across the widest part of the
   wedge and flatten it. */
const DASH_PATHS = [
  'M484 780 L540 780 L532.7 668 L491.3 668 Z',
  'M494.9 612 L529.1 612 L524.7 544 L499.3 544 Z',
  'M501.6 508 L522.4 508 L519.5 464 L504.5 464 Z'
];

/* The sun. Sits above the road's vanishing point with a 10px gap, so it reads
   as beyond the horizon rather than as a ball resting on the tarmac. */
const SUN = { cx: 512, cy: 316, r: 64 };

const CANVAS = 1024;

/* Furthest extent of any ink from the canvas centre, used to prove the mark
   fits a maskable icon's safe zone. Bottom road corners are the extreme:
   hypot(280, 268) = 388, against the 409.6 (80% diameter) safe radius. */
const MARK_SAFE_RADIUS = 388;

/* ------------------------------------------------------------------ helpers */

/** Rounded-rect path used where we must draw the icon silhouette ourselves
 *  (the launch screen), since there is no OS mask there.
 *  r = 22.37% of the side is the standard iOS app-icon corner ratio. Apple's
 *  real shape is a superellipse; at launch-screen sizes the difference between
 *  that and a circular-arc corner is sub-pixel, and a wrong squircle looks
 *  worse than an honest rounded rect. */
const roundedRectPath = (x, y, size, radius) => {
  const r = radius === undefined ? size * 0.2237 : radius;
  return [
    `M${x + r} ${y}`,
    `H${x + size - r}`,
    `A${r} ${r} 0 0 1 ${x + size} ${y + r}`,
    `V${y + size - r}`,
    `A${r} ${r} 0 0 1 ${x + size - r} ${y + size}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + size - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z'
  ].join(' ');
};

/** Gradient stop list -> SVG <stop> elements, offsets in px over `span`. */
const pxStops = (stops, span, base) => {
  const body = stops
    .map(([px, hex]) => `<stop offset="${(px / span).toFixed(5)}" stop-color="${hex}"/>`)
    .join('');
  return `${body}<stop offset="1" stop-color="${base}"/>`;
};

/** The three ink shapes, in paint order. `idp` namespaces gradient ids so two
 *  marks can coexist in one document without one stealing the other's fill. */
const markShapes = (idp) => `
  <circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}" fill="url(#${idp}sun)"/>
  <path fill="${COLOR.road}" fill-rule="evenodd" d="${ROAD_PATH} ${DASH_PATHS.join(' ')}"/>
`;

const markDefs = (idp) => `
  <linearGradient id="${idp}sun" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${COLOR.sunTop}"/>
    <stop offset="1" stop-color="${COLOR.sunBottom}"/>
  </linearGradient>
`;

/* The plate ramp. 160deg in CSS terms, expressed as the equivalent vector in
   objectBoundingBox units: horizontal:vertical = 0.364:1, hence 0.32 -> 0.68. */
const plateDefs = (idp) => `
  <linearGradient id="${idp}plate" x1="0.32" y1="0" x2="0.68" y2="1">
    <stop offset="0" stop-color="${COLOR.plateTop}"/>
    <stop offset="1" stop-color="${COLOR.plateBottom}"/>
  </linearGradient>
  <radialGradient id="${idp}sheen" cx="0.5" cy="0.02" r="0.78">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.14"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
`;

/* -------------------------------------------------------------- app icon --- */

/**
 * Full-bleed app icon.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.maskable]  Scale the mark down for Android's maskable
 *   contract. The mark already fits the 80%-diameter safe circle (388 < 409.6),
 *   but Android vendors apply masks tighter than the spec's circle, so the
 *   maskable variant backs off to 84% and buys real margin. Kept as a separate
 *   asset rather than declaring one file `"any maskable"`, so neither purpose
 *   has to compromise.
 * @param {boolean} [opts.rounded]  Draw the iOS corner ourselves. Only for
 *   contexts with no OS mask (launch screen, favicon). Never for
 *   apple-touch-icon: iOS masks that itself and would double the corner.
 */
const appIconSvg = ({ maskable = false, rounded = false } = {}) => {
  const idp = maskable ? 'm-' : 'i-';
  const scale = maskable ? 0.84 : 1;
  const plate = rounded
    ? `<path d="${roundedRectPath(0, 0, CANVAS)}" fill="url(#${idp}plate)"/>
       <path d="${roundedRectPath(0, 0, CANVAS)}" fill="url(#${idp}sheen)"/>`
    : `<rect width="${CANVAS}" height="${CANVAS}" fill="url(#${idp}plate)"/>
       <rect width="${CANVAS}" height="${CANVAS}" fill="url(#${idp}sheen)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>${plateDefs(idp)}${markDefs(idp)}</defs>
  ${plate}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    ${markShapes(idp)}
  </g>
</svg>`;
};

/* --------------------------------------------------------------- favicon --- */

/** Favicon. Rounded because a browser tab applies no mask, and at 16px the
 *  corner radius is what stops it reading as a hard navy block. */
const faviconSvg = () => appIconSvg({ rounded: true });

/* --------------------------------------------------------- launch screen --- */

/**
 * iOS launch screen (`apple-touch-startup-image`).
 *
 * Apple's launch-screen guidance is that it should look like the app's first
 * screen, not like a branded splash — a splash advertises a load, a matching
 * first screen hides it. We take the compliant half of that: the background is
 * the app's real first paint, hex for hex, copied from `.app-shell::before`.
 *
 * We do NOT try to fake the nav bar and tab dock on top of it. Those positions
 * derive from per-device safe-area insets, and a chrome silhouette that lands
 * two pixels off its real counterpart looks broken in a way a plain background
 * never does. So: real background, plus the app icon at the size iOS itself
 * uses for a generated launch image, and no text — nothing to mis-localise and
 * nothing that can be misaligned.
 *
 * @param {number} width   CSS px
 * @param {number} height  CSS px
 * @param {'light'|'dark'} scheme
 */
const splashSvg = ({ width, height, scheme = 'light' }) => {
  const dark = scheme === 'dark';
  const stops = dark ? COLOR.splashDark : COLOR.splashLight;
  const base = dark ? COLOR.splashDarkBase : COLOR.splashLightBase;
  const idp = `s${scheme[0]}-`;

  // The wash is a fixed 460px band in the app regardless of screen height, so
  // it must stay 460px here too, not a percentage. Otherwise a 12.9" iPad gets
  // a warm gradient stretched over a third of the display and the handoff to
  // the real app is a visible jump.
  const bandStops = pxStops(stops, height, base);

  // Icon size: iOS renders a generated launch icon at roughly the same optical
  // weight as a large Home Screen icon. Clamped so a 1024pt iPad does not get a
  // billboard and a 320pt phone does not get a stamp.
  const mark = Math.round(Math.min(168, Math.max(88, Math.min(width, height) * 0.26)));
  const x = Math.round((width - mark) / 2);
  const y = Math.round((height - mark) / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="${idp}bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${height}">
      ${bandStops}
    </linearGradient>
    ${plateDefs(idp)}${markDefs(idp)}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#${idp}bg)"/>
  <g transform="translate(${x} ${y}) scale(${(mark / CANVAS).toFixed(6)})">
    <path d="${roundedRectPath(0, 0, CANVAS)}" fill="url(#${idp}plate)"/>
    <path d="${roundedRectPath(0, 0, CANVAS)}" fill="url(#${idp}sheen)"/>
    ${markShapes(idp)}
  </g>
</svg>`;
};

module.exports = {
  COLOR,
  CANVAS,
  ROAD_PATH,
  DASH_PATHS,
  SUN,
  MARK_SAFE_RADIUS,
  roundedRectPath,
  appIconSvg,
  faviconSvg,
  splashSvg
};
