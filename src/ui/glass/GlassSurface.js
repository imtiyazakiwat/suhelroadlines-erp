import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { detectGlassTier } from './capabilities';
import { getDisplacementMap } from './displacementMap';
import './glass.css';

/* =============================================================================
   GlassSurface — the single Liquid Glass primitive.

   Layer order, back to front:
     1. refract   backdrop-filter: url(#displacement) — bends the backdrop
     2. frost     backdrop-filter: blur + saturate + brightness
     3. tint      translucent fill that gives the material its body
     4. specular  baked highlight sweep + bright rim
     5. content   your children, never filtered, always crisp

   Rules enforced here rather than left to callers:
     - a surface inside another glass surface renders flat (no glass on glass)
     - Reduce Transparency collapses every tier to an opaque fill
     - the displacement map regenerates only when the box actually changes size
   ========================================================================== */

const GlassContext = React.createContext(false);

const useSize = (ref, enabled) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!enabled || !ref.current) return undefined;

    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const { width, height } = node.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height }
      );
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, enabled]);

  return size;
};

let uid = 0;

const GlassSurface = React.forwardRef(function GlassSurface(
  {
    as: Tag = 'div',
    variant = 'regular',
    radius,
    capsule = false,
    interactive = false,
    dim = false,
    className = '',
    style,
    children,
    ...rest
  },
  forwardedRef
) {
  const ref = useRef(null);

  // Expose the surface node to callers while keeping our own measuring ref.
  const setNode = (node) => {
    ref.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };
  const nested = React.useContext(GlassContext);
  const [filterId] = useState(() => `glass-${(uid += 1)}`);

  // A nested surface must not re-blur an already-blurred backdrop.
  const tier = nested ? 'opaque' : detectGlassTier();
  const wantsDisplacement = tier === 'displacement';

  const { width, height } = useSize(ref, wantsDisplacement);

  const resolvedRadius = useMemo(() => {
    if (capsule) return Math.min(width, height) / 2 || 999;
    if (typeof radius === 'number') return radius;
    return 22;
  }, [capsule, radius, width, height]);

  const mapUrl = useMemo(() => {
    if (!wantsDisplacement || width < 8 || height < 8) return null;
    return getDisplacementMap({ width, height, radius: resolvedRadius, variant });
  }, [wantsDisplacement, width, height, resolvedRadius, variant]);

  // Safari caches SVG filter output by id; bumping the id on remap avoids a
  // stale frame. Harmless in Chromium.
  const scopedId = mapUrl ? `${filterId}-${Math.round(width)}x${Math.round(height)}` : filterId;

  const cssRadius = capsule ? 'var(--r-capsule)' : `${resolvedRadius}px`;

  return (
    <GlassContext.Provider value>
      <Tag
        ref={setNode}
        className={[
          'glass',
          `glass--${variant}`,
          `glass--${tier}`,
          interactive ? 'glass--interactive' : '',
          className
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--glass-radius': cssRadius, ...style }}
        {...rest}
      >
        {mapUrl && (
          <>
            <svg className="glass__defs" aria-hidden="true" focusable="false">
              <defs>
                <filter
                  id={scopedId}
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  filterUnits="objectBoundingBox"
                  primitiveUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feImage
                    href={mapUrl}
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    preserveAspectRatio="none"
                    result="map"
                  />
                  {/* Three taps at slightly different scales split the channels,
                      which is what produces the rainbow fringe at the rim. */}
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={Math.max(width, height) * 0.09}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="red"
                  />
                  <feColorMatrix
                    in="red"
                    type="matrix"
                    values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                    result="redOnly"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={Math.max(width, height) * 0.083}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="green"
                  />
                  <feColorMatrix
                    in="green"
                    type="matrix"
                    values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
                    result="greenOnly"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={Math.max(width, height) * 0.076}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="blue"
                  />
                  <feColorMatrix
                    in="blue"
                    type="matrix"
                    values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
                    result="blueOnly"
                  />
                  <feBlend in="redOnly" in2="greenOnly" mode="screen" result="rg" />
                  <feBlend in="rg" in2="blueOnly" mode="screen" />
                </filter>
              </defs>
            </svg>
            <span
              className="glass__refract"
              style={{ backdropFilter: `url(#${scopedId})`, WebkitBackdropFilter: `url(#${scopedId})` }}
              aria-hidden="true"
            />
          </>
        )}

        {dim && <span className="glass__dim" aria-hidden="true" />}
        <span className="glass__frost" aria-hidden="true" />
        <span className="glass__tint" aria-hidden="true" />
        <span className="glass__specular" aria-hidden="true" />
        <span className="glass__content">{children}</span>
      </Tag>
    </GlassContext.Provider>
  );
});

export const useInsideGlass = () => React.useContext(GlassContext);

export default GlassSurface;
