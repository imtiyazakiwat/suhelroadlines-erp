import React, { useEffect, useState } from 'react';
import GlassSurface from '../glass/GlassSurface';
import './chrome.css';

/* =============================================================================
   NavBar — iOS 26 scroll edge effect.

   At rest the bar is transparent and the content shows through. Once content
   scrolls beneath it, glass and a hairline fade in. That transition is the
   single most recognisable piece of iOS 26 chrome, and it's why a static
   translucent bar reads as "web app".

   Optional large title collapses into the inline title as you scroll, the
   same way UINavigationBar's prefersLargeTitles does.
   ========================================================================== */

const SCROLL_ON = 6;

export const useScrolled = (threshold = SCROLL_ON) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      setScrolled((window.scrollY || document.documentElement.scrollTop || 0) > threshold);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return scrolled;
};

const NavBar = ({
  title,
  subtitle = null,
  largeTitle = false,
  leading = null,
  trailing = null,
  transparent = false,
  className = '',
  children
}) => {
  const scrolled = useScrolled();
  const showEdge = !transparent || scrolled;

  return (
    <>
      <header
        className={[
          'nav26',
          showEdge ? 'is-edged' : '',
          largeTitle ? 'nav26--large' : '',
          className
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="nav26__material" aria-hidden="true" />

        <div className="nav26__bar">
          <div className="nav26__side">{leading}</div>

          {subtitle ? (
            /* Stacked title, the way UINavigationItem shows a prompt: the
               screen keeps its name and the state sits underneath it. */
            <div className="nav26__titles">
              <h1 className="nav26__title">{title}</h1>
              <span className="nav26__subtitle">{subtitle}</span>
            </div>
          ) : (
            <h1 className={`nav26__title ${largeTitle && !scrolled ? 'is-hidden' : ''}`.trim()}>
              {title}
            </h1>
          )}

          <div className="nav26__side nav26__side--end">{trailing}</div>
        </div>

        {children && <div className="nav26__accessory">{children}</div>}
      </header>

      {largeTitle && (
        <div className={`nav26__large-title ${scrolled ? 'is-collapsed' : ''}`.trim()}>
          <h2>{title}</h2>
        </div>
      )}
    </>
  );
};

/** Circular glass-free icon button sized for the nav bar. */
export const NavButton = ({ label, badge = false, onClick, className = '', children }) => (
  <button
    type="button"
    className={`nav26__btn ${badge ? 'has-badge' : ''} ${className}`.trim()}
    aria-label={label}
    onClick={onClick}
  >
    {children}
  </button>
);

/**
 * Search affordance: a Liquid Glass capsule that reads as a field rather than
 * a bare icon, so it's obvious it opens search. Collapses to a circle on narrow
 * screens where the label won't fit.
 */
export const NavSearchButton = ({ label = 'Search', placeholder = 'Search', onClick }) => (
  <GlassSurface
    as="button"
    type="button"
    capsule
    interactive
    variant="regular"
    className="nav26__search"
    aria-label={label}
    onClick={onClick}
  >
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="m20 20-3.6-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
    <span className="nav26__search-label">{placeholder}</span>
  </GlassSurface>
);

/** iOS back affordance: chevron + optional previous-screen label. */
export const BackButton = ({ label = 'Back', onClick }) => (
  <button type="button" className="nav26__back" onClick={onClick}>
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" focusable="false">
      <path
        d="m14.5 5.5-7 6.5 7 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span>{label}</span>
  </button>
);

export default NavBar;
