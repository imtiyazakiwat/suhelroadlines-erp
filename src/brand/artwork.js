/* =============================================================================
   Suhel Roadlines — brand artwork, as geometry
   =============================================================================

   WHY THIS FILE EXISTS
   iOS will not accept SVG for `apple-touch-icon` or `apple-touch-startup-image`;
   both must be raster PNG (Apple, "Configuring Web Applications":
   https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
   — "place an icon file in PNG format ... called apple-touch-icon.png").

   So we cannot ship vector only. The answer is not to hand-draw PNGs: it is to
   keep ONE vector definition and *derive* every raster from it at build time
   (`scripts/generate-brand-assets.js`). The icon, favicon, launch screens and
   the in-app mark then cannot drift apart, because there is one set of numbers.

   Deliberately CommonJS and framework-free: the Node generator `require`s it and
   webpack imports it for the React mark. One source, two consumers.

   ---------------------------------------------------------------------------
   THE MARK
   ---------------------------------------------------------------------------
   A dashed roadline curving up the frame, with a low sun.

   *Why not a monogram?* Apple's app-icon guidance is one simple subject, and to
   avoid text — text does not localise and two letters at the real render size
   (60x60pt) smear. Also decisive: drawing letters needs font outlines, and
   `resvg` resolves fonts from the host, so a text icon would rasterise
   differently on a Mac and on Netlify's Linux builder. Geometry is reproducible.

   *Why a dashed line and not a solid road?* Earlier iterations drew the road in
   one-point perspective as a symmetric wedge. Rendered and inspected, every one
   of them read as a capital **A**: a wedge narrowing to an apex with a centred
   gap is a letterform, and adding a horizon just gave it a crossbar. The fix was
   to abandon symmetry. A curve has no letterform reading, and the dashes are
   what make it a *road* rather than a wire — they are the "lines" in Roadlines.

   *Why is the sun detached from the end of the line?* It was tried tangent to
   the terminus first, and it read as a match head or a lollipop — the disc and
   the stroke fused into one object. Held clear of the line it separates into two
   things: a road, and a sun. Distance is doing the work, not size.

   *Why is it needed at all?* The app ships Create React App's React logo today.
   The icon is the one part of this app the user sees while NOT using it, and a
   framework's stock logo on the Home Screen says "this is a web page".

   *Why these colours?* From the existing token layer, not invented: the plate is
   the brand navy (`--brand-gradient`, #14386F -> #0A2450) and the sun is
   `--sys-orange` (#FF9500), the hue of the warm wash at the top of every screen
   (`AppLayout.css`). Icon, launch screen and first paint are then the same three
   colours in the same order, so launching reads as one continuous movement. The
   navy is opened up at the top of the ramp (#1E4E8C) because an icon sits on an
   unknown wallpaper at 60pt and needs more internal contrast than a 34px avatar
   on a white nav bar.

   *What does it cost?* Nothing at runtime: two strokes, one circle, two
   gradients. No filters, no embedded raster. That is why the generated PNGs
   compress to a few KB.

   ---------------------------------------------------------------------------
   COORDINATE SYSTEM
   ---------------------------------------------------------------------------
   1024x1024 — Apple's master icon size. The app icon is full-bleed and
   deliberately does NOT round its own corners: iOS applies the mask itself, and
   a pre-rounded icon shows a visible double corner.

   Every gradient uses gradientUnits="userSpaceOnUse" so the dash stroke can
   reuse the *plate* gradient and match it exactly. With the default
   objectBoundingBox the dash gradient would resolve against the dash path's own
   bounding box and the "holes" would be a visibly different navy.
   ========================================================================== */

const CANVAS = 1024;

const COLOR = {
  plateTop: '#1E4E8C',
  plateBottom: '#0A2450',
  sunTop: '#FFC163',
  sunBottom: '#FF9500',
  road: '#FFFFFF',

  /* Launch-screen backgrounds mirror `.app-shell::before` in AppLayout.css
     hex for hex and px for px, so the launch image and the app's first painted
     frame are indistinguishable. */
  splashLight: [[0, '#FBE1CB'], [120, '#FDEEE1'], [300, '#F5F6F6'], [440, '#F2F2F7']],
  splashDark: [[0, '#2A1D14'], [130, '#1C1712'], [320, '#0B0B0C'], [440, '#000000']],
  splashLightBase: '#F2F2F7', // --bg-grouped, light
  splashDarkBase: '#000000' //  --bg-grouped, dark
};

/* The roadline. A shallow S rising left-to-right, so the mark fills the frame
   on the diagonal instead of sitting in a vertical column. Endpoints are inset
   by more than half the stroke width (56) to keep the round caps off the edges
   before the OS mask is applied. */
const ROAD_CURVE = 'M244 806 C244 590 470 600 548 500 C626 400 782 424 782 232';
const ROAD_WIDTH = 112;

/* Centre dashes, stroked over the road in the plate colour so they are holes.
   16-on / 96-off gives seven marks along this curve: enough to read as a
   dashed line, few enough that they do not vibrate at small sizes. */
const DASH_WIDTH = Math.round(ROAD_WIDTH * 0.135 * 100) / 100; // 15.12
const DASH_ARRAY = '16 96';

/* The sun, held clear of the line. */
const SUN = { cx: 268, cy: 232, r: 84 };

/* Furthest ink from the canvas centre: the near cap centre (244,806) plus its
   56 radius = 453.8, which exceeds a maskable icon's 409.6 safe radius. Hence
   the separate 0.84-scaled maskable variant below (453.8 * 0.84 = 381). */
const MARK_OUTER_RADIUS = 453.8;
const MASKABLE_SCALE = 0.84;

/** Rounded-rect path, for the contexts where no OS mask exists (launch screen,
 *  favicon). r = 22.37% of the side is the iOS app-icon corner ratio. Apple's
 *  true shape is a superellipse; at these sizes the difference from a circular
 *  corner is sub-pixel, and a wrong squircle looks worse than an honest fillet. */
const roundedRectPath = (x, y, size, radius) => {
  const r = radius === undefined ? size * 0.2237 : radius;
  return [
    `M${x + r} ${y}`, `H${x + size - r}`, `A${r} ${r} 0 0 1 ${x + size} ${y + r}`,
    `V${y + size - r}`, `A${r} ${r} 0 0 1 ${x + size - r} ${y + size}`,
    `H${x + r}`, `A${r} ${r} 0 0 1 ${x} ${y + size - r}`,
    `V${y + r}`, `A${r} ${r} 0 0 1 ${x + r} ${y}`, 'Z'
  ].join(' ');
};

/** Gradients, in user space so the dash stroke can reuse the plate ramp. */
const iconDefs = (p) => `
  <linearGradient id="${p}plate" gradientUnits="userSpaceOnUse"
    x1="327.68" y1="0" x2="696.32" y2="${CANVAS}">
    <stop offset="0" stop-color="${COLOR.plateTop}"/>
    <stop offset="1" stop-color="${COLOR.plateBottom}"/>
  </linearGradient>
  <linearGradient id="${p}sun" gradientUnits="userSpaceOnUse"
    x1="${SUN.cx}" y1="${SUN.cy - SUN.r}" x2="${SUN.cx}" y2="${SUN.cy + SUN.r}">
    <stop offset="0" stop-color="${COLOR.sunTop}"/>
    <stop offset="1" stop-color="${COLOR.sunBottom}"/>
  </linearGradient>
  <radialGradient id="${p}sheen" gradientUnits="userSpaceOnUse"
    cx="512" cy="20" r="800">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.14"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>`;

/** Sun + road + dash holes, in paint order. */
const markShapes = (p) => `
  <circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}" fill="url(#${p}sun)"/>
  <path d="${ROAD_CURVE}" fill="none" stroke="${COLOR.road}"
        stroke-width="${ROAD_WIDTH}" stroke-linecap="round"/>
  <path d="${ROAD_CURVE}" fill="none" stroke="url(#${p}plate)"
        stroke-width="${DASH_WIDTH}" stroke-dasharray="${DASH_ARRAY}" stroke-linecap="butt"/>`;

/**
 * The app icon.
 * @param {boolean} [maskable] Scale the mark in for Android's maskable contract.
 *   Kept as a separate asset rather than declaring one file "any maskable", so
 *   neither purpose has to compromise: `any` fills the frame, `maskable` clears
 *   the safe circle with room for vendors whose masks are tighter than the spec.
 * @param {boolean} [rounded] Draw the iOS corner ourselves. Only where there is
 *   no OS mask. Never for apple-touch-icon — iOS masks that and would double it.
 */
const appIconSvg = ({ maskable = false, rounded = false } = {}) => {
  const p = maskable ? 'm-' : 'i-';
  const silhouette = rounded ? roundedRectPath(0, 0, CANVAS) : null;
  const plate = rounded
    ? `<path d="${silhouette}" fill="url(#${p}plate)"/><path d="${silhouette}" fill="url(#${p}sheen)"/>`
    : `<rect width="${CANVAS}" height="${CANVAS}" fill="url(#${p}plate)"/>
       <rect width="${CANVAS}" height="${CANVAS}" fill="url(#${p}sheen)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>${iconDefs(p)}</defs>
  ${plate}
  <g transform="translate(512 512) scale(${maskable ? MASKABLE_SCALE : 1}) translate(-512 -512)">
    ${markShapes(p)}
  </g>
</svg>`;
};

/** Favicon. Rounded because a browser tab applies no mask, and the corner is
 *  what stops it reading as a hard navy block at 16px. */
const faviconSvg = () => appIconSvg({ rounded: true });

/**
 * iOS launch screen (`apple-touch-startup-image`).
 *
 * Apple's launch-screen guidance is that it should resemble the app's first
 * screen rather than be a branded splash — a splash advertises the wait, a
 * matching first screen hides it. We take the compliant half: the background is
 * the app's real first paint, copied from `.app-shell::before`.
 *
 * We do NOT fake the nav bar and tab dock on top. Their positions derive from
 * per-device safe-area insets, and a chrome silhouette landing two pixels off
 * its real counterpart looks broken in a way a plain background never does.
 * So: the real background, the icon, and no text to mis-localise.
 */
const splashSvg = ({ width, height, scheme = 'light' }) => {
  const dark = scheme === 'dark';
  const stops = dark ? COLOR.splashDark : COLOR.splashLight;
  const base = dark ? COLOR.splashDarkBase : COLOR.splashLightBase;
  const p = `s${dark ? 'd' : 'l'}-`;

  /* The wash is a fixed 460px band in the app regardless of screen height, so
     it stays 460px here — not a percentage. Otherwise a 12.9" iPad gets the warm
     gradient stretched over a third of the display and the handoff to the real
     app is a visible jump. */
  const band = stops
    .map(([px, hex]) => `<stop offset="${(px / height).toFixed(5)}" stop-color="${hex}"/>`)
    .join('') + `<stop offset="1" stop-color="${base}"/>`;

  /* Clamped so a 1024pt iPad does not get a billboard and a 320pt phone does
     not get a stamp. */
  const mark = Math.round(Math.min(168, Math.max(88, Math.min(width, height) * 0.26)));
  const x = Math.round((width - mark) / 2);
  const y = Math.round((height - mark) / 2);
  const scale = mark / CANVAS;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="${p}bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${height}">${band}</linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#${p}bg)"/>
  <g transform="translate(${x} ${y}) scale(${scale.toFixed(6)})">
    <defs>${iconDefs(p)}</defs>
    <path d="${roundedRectPath(0, 0, CANVAS)}" fill="url(#${p}plate)"/>
    <path d="${roundedRectPath(0, 0, CANVAS)}" fill="url(#${p}sheen)"/>
    ${markShapes(p)}
  </g>
</svg>`;
};

module.exports = {
  CANVAS,
  COLOR,
  ROAD_CURVE,
  ROAD_WIDTH,
  DASH_WIDTH,
  DASH_ARRAY,
  SUN,
  MARK_OUTER_RADIUS,
  MASKABLE_SCALE,
  roundedRectPath,
  iconDefs,
  markShapes,
  appIconSvg,
  faviconSvg,
  splashSvg
};
