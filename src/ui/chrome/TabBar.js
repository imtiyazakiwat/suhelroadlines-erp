import React, { useLayoutEffect, useRef, useState } from 'react';
import GlassSurface from '../glass/GlassSurface';
import './chrome.css';

/* =============================================================================
   TabBar — the iOS 26 floating tab bar.

   Shape from the reference: a glass capsule inset from the screen edges rather
   than a full-width bar welded to the bottom, with secondary actions living in
   their own detached capsule alongside it.

   The selected tab is marked by a Liquid Glass pill that slides between items,
   so selection reads as one continuous piece of glass moving rather than a
   background colour swapping.
   ========================================================================== */

export const TabBar = ({ tabs = [], value, onChange, trailing = null, className = '' }) => {
  const listRef = useRef(null);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  // -1 when the current route isn't a tab root (e.g. /add-entry). In that case
  // no tab is selected and the pill hides, rather than falsely landing on Home.
  const activeIndex = tabs.findIndex((tab) => tab.value === value);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    if (activeIndex < 0) {
      setPill((prev) => ({ ...prev, ready: false }));
      return undefined;
    }

    const place = () => {
      // Same off-by-one trap as Segmented: .tab26__pill is children[0].
      const item = list.querySelectorAll('[role="tab"]')[activeIndex];
      if (!item) return;
      setPill({ left: item.offsetLeft, width: item.offsetWidth, ready: true });
    };

    place();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', place);
      return () => window.removeEventListener('resize', place);
    }
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeIndex, tabs.length]);

  return (
    <div className={`tabdock26 ${className}`.trim()}>
      <GlassSurface variant="regular" capsule className="tab26">
        <div className="tab26__list" ref={listRef} role="tablist">
          <span
            className={`tab26__pill ${pill.ready ? 'is-ready' : ''}`}
            style={{ transform: `translateX(${pill.left}px)`, width: `${pill.width}px` }}
            aria-hidden="true"
          />

          {tabs.map((tab) => {
            const selected = tab.value === value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={tab.label}
                className={`tab26__item ${selected ? 'is-selected' : ''}`}
                onClick={() => onChange?.(tab.value)}
              >
                <span className="tab26__icon">
                  {typeof tab.icon === 'function' ? tab.icon({ selected }) : tab.icon}
                  {tab.badge > 0 && (
                    <span className="tab26__badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
                  )}
                </span>
                <span className="tab26__label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </GlassSurface>

      {trailing && <div className="tabdock26__trailing">{trailing}</div>}
    </div>
  );
};

/** Detached circular glass button that sits beside the tab capsule. */
export const DockButton = ({ label, onClick, active = false, tone = 'glass', className = '', children }) => {
  if (tone === 'solid') {
    return (
      <button
        type="button"
        className={`dock26 dock26--solid ${active ? 'is-active' : ''} ${className}`.trim()}
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  return (
    <GlassSurface
      as="button"
      capsule
      interactive
      variant="regular"
      className={`dock26 ${active ? 'is-active' : ''} ${className}`.trim()}
      aria-label={label}
      onClick={onClick}
      type="button"
    >
      {children}
    </GlassSurface>
  );
};

export default TabBar;
