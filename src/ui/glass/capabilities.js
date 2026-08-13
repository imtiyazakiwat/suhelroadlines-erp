/* =============================================================================
   Glass capability detection.

   Three rendering tiers, resolved once per session:

     'displacement' — backdrop-filter accepts an SVG url() filter, so the
                      backdrop can be genuinely refracted through a
                      feDisplacementMap. Chromium only today.
     'frost'        — backdrop-filter works but only with built-in functions
                      (blur/saturate/brightness). Safari, Firefox.
     'opaque'       — no backdrop-filter, or the user asked for reduced
                      transparency. Glass collapses to a solid surface.

   Apple's guidance is that glass must degrade to something legible when
   Reduce Transparency is on, so that setting overrides capability entirely.
   ========================================================================== */

let cached = null;

const canQuery = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export const prefersReducedTransparency = () =>
  canQuery() && window.matchMedia('(prefers-reduced-transparency: reduce)').matches;

export const prefersReducedMotion = () =>
  canQuery() && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const supportsBackdropFilter = () => {
  if (typeof CSS === 'undefined' || !CSS.supports) return false;
  return (
    CSS.supports('backdrop-filter', 'blur(1px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
  );
};

/**
 * WebKit parses `backdrop-filter: url(#id)` but silently drops the filter, so
 * CSS.supports is not enough to tell us whether displacement will actually
 * render. Gate on the engine instead: Chromium ships it, WebKit and Gecko
 * don't. Checked via a Blink-only CSS property rather than UA sniffing.
 */
const supportsBackdropSvgFilter = () => {
  if (typeof CSS === 'undefined' || !CSS.supports) return false;
  if (!CSS.supports('backdrop-filter', 'url(#x)')) return false;

  // `overflow-anchor` is implemented in Blink and Gecko but not WebKit;
  // `-webkit-app-region` is Blink-only. Together they isolate Chromium.
  const isBlink = CSS.supports('-webkit-app-region', 'no-drag');
  return isBlink;
};

/** @returns {'displacement'|'frost'|'opaque'} */
export const detectGlassTier = () => {
  if (cached) return cached;

  if (prefersReducedTransparency() || !supportsBackdropFilter()) {
    cached = 'opaque';
  } else if (supportsBackdropSvgFilter()) {
    cached = 'displacement';
  } else {
    cached = 'frost';
  }

  return cached;
};

/** Test seam — lets a test force a tier without touching CSS.supports. */
export const __setGlassTier = (tier) => {
  cached = tier;
};

export const resetGlassTier = () => {
  cached = null;
};
