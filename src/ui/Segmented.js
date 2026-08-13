import React, { useLayoutEffect, useRef, useState } from 'react';
import './Segmented.css';

/* =============================================================================
   Segmented control.

   The selected pill is a single element that slides between positions rather
   than a per-option background — that sliding motion is what makes it read as
   iOS rather than as a row of tabs.
   ========================================================================== */

const Segmented = ({ options = [], value, onChange, className = '', ariaLabel = 'Options' }) => {
  const listRef = useRef(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0, ready: false });

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    const place = () => {
      // Query the tabs rather than indexing children: the thumb is itself the
      // first child, so children[activeIndex] measured the wrong element and
      // the pill landed one tab off.
      const button = list.querySelectorAll('[role="tab"]')[activeIndex];
      if (!button) return;
      setThumb({ left: button.offsetLeft, width: button.offsetWidth, ready: true });
    };

    place();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', place);
      return () => window.removeEventListener('resize', place);
    }
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeIndex, options.length]);

  return (
    <div className={`seg26 ${className}`.trim()} role="tablist" aria-label={ariaLabel} ref={listRef}>
      <span
        className={`seg26__thumb ${thumb.ready ? 'is-ready' : ''}`}
        style={{ transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px` }}
        aria-hidden="true"
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`seg26__item ${selected ? 'is-selected' : ''}`}
            onClick={() => onChange?.(option.value)}
          >
            {option.label}
            {option.count !== undefined && <span className="seg26__count">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default Segmented;
