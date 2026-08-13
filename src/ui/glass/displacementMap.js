/* =============================================================================
   Displacement map generation.

   The lens maths comes from liquid-glass-web-react's `renderDisplacementMap`
   (MIT) — https://github.com/PallavAg/liquid-glass-web-react — which encodes
   bend distance in red/green, a baked specular highlight in blue, and the exact
   rounded-rect lens shape in alpha. We only borrow the map; the filter that
   consumes it is ours (see GlassDefs), because we refract the *backdrop* of a
   chrome surface rather than a copy of page content.

   Maps are cached by shape. Moving a surface never regenerates one; only a
   change of size or corner radius does.
   ========================================================================== */

import { renderDisplacementMap } from 'liquid-glass-web-react';

const cache = new Map();

/** Shared canvas so we don't allocate one per surface. */
let scratch = null;

const getCanvas = () => {
  if (typeof document === 'undefined') return null;
  if (!scratch) scratch = document.createElement('canvas');
  return scratch;
};

/**
 * Physical profile of the glass edge. `depth` is the width of the refracting
 * band and `domeDepth` how spherical the lens is — a thin band with a shallow
 * dome reads as a crisp pane of glass rather than a magnifying bubble, which
 * is what iOS chrome looks like.
 */
export const GLASS_PROFILE = {
  regular: {
    depth: 11,
    domeDepth: 7,
    splay: 1,
    glow: 0.1,
    glowSpread: 0.5,
    glowExponent: 2,
    edgeHighlight: 0.3,
    edgeWidth: 3,
    edgeExponent: 2.2,
    specularAngle: 145
  },
  clear: {
    depth: 15,
    domeDepth: 11,
    splay: 1,
    glow: 0.16,
    glowSpread: 0.55,
    glowExponent: 2,
    edgeHighlight: 0.42,
    edgeWidth: 4,
    edgeExponent: 2,
    specularAngle: 145
  }
};

const keyFor = (w, h, radius, variant, quality) =>
  `${Math.round(w)}x${Math.round(h)}r${Math.round(radius)}-${variant}-${quality}`;

/**
 * @param {object} p
 * @param {number} p.width    surface width in CSS px
 * @param {number} p.height   surface height in CSS px
 * @param {number} p.radius   corner radius in CSS px
 * @param {'regular'|'clear'} [p.variant]
 * @param {number} [p.quality] map resolution, power of two
 * @returns {string|null} PNG data URL, or null when unavailable
 */
export const getDisplacementMap = ({
  width,
  height,
  radius,
  variant = 'regular',
  quality = 256
}) => {
  if (!width || !height) return null;

  const key = keyFor(width, height, radius, variant, quality);
  if (cache.has(key)) return cache.get(key);

  const canvas = getCanvas();
  if (!canvas) return null;

  const profile = GLASS_PROFILE[variant] || GLASS_PROFILE.regular;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  try {
    const url = renderDisplacementMap(
      {
        size: quality,
        halfWidth,
        halfHeight,
        // clamp so a capsule's radius can't exceed its own half-height
        radius: Math.min(radius, Math.min(halfWidth, halfHeight)),
        ...profile
      },
      canvas
    );

    cache.set(key, url);
    return url;
  } catch (error) {
    console.warn('glass: displacement map generation failed:', error.message);
    cache.set(key, null);
    return null;
  }
};

export const clearDisplacementCache = () => cache.clear();
