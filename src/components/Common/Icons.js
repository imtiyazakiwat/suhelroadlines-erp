import React from 'react';

/**
 * Shared SVG icon set.
 * All icons render at `size` (default 24) and inherit `currentColor`,
 * so colour is controlled entirely by CSS.
 */

const base = (size, extra = {}) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
  ...extra
});

export const TruckIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <path d="M2 8.5A1.5 1.5 0 0 1 3.5 7H14v9H3.5A1.5 1.5 0 0 1 2 14.5v-6Z" />
    <path d="M14 10h3.6a2 2 0 0 1 1.7.95L21.5 14v2H14v-6Z" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17.5" cy="18" r="2" />
    <path d="M9 18h6.5" />
  </svg>
);

export const WalletIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="5.5" width="19" height="14" rx="3" />
    <path d="M2.5 10h19" />
    <path d="M9 14.5h2.5M13 13v3M12 13h1.6a.9.9 0 0 1 0 1.8H12M12 14.8h1.8" />
  </svg>
);

export const RupeeIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <path d="M7 5h10M7 9h10M15.5 5c0 3.6-2.6 4.9-6 4.9L16 19" />
  </svg>
);

export const DocCheckIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="M8.75 14.2l1.9 1.9 3.9-3.9" />
  </svg>
);

export const DocAlertIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="M12 11.5v3.2" />
    <path d="M12 17.4h.01" />
  </svg>
);

export const SearchIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2 })} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const BellIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 1.9 })} className={className}>
    <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" />
    <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
  </svg>
);

export const ChevronRightIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2 })} className={className}>
    <path d="m9.5 5.5 7 6.5-7 6.5" />
  </svg>
);

export const ChevronLeftIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2.2 })} className={className}>
    <path d="m14.5 5.5-7 6.5 7 6.5" />
  </svg>
);

export const ChevronDownIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2 })} className={className}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const ArrowRightIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2 })} className={className}>
    <path d="M4.5 12h14" />
    <path d="m13 6.5 5.5 5.5L13 17.5" />
  </svg>
);

export const HomeIcon = ({ size = 24, className = '', filled = false }) =>
  filled ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M11.3 2.6a1 1 0 0 1 1.4 0l8 7.2a1 1 0 0 1 .3.75V20a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.3a1.5 1.5 0 0 0-1.5-1.5h-3.6a1.5 1.5 0 0 0-1.5 1.5v5.3H4.5A1.5 1.5 0 0 1 3 20v-9.45a1 1 0 0 1 .33-.75l7.97-7.2Z" />
    </svg>
  ) : (
    <svg {...base(size)} className={className}>
      <path d="M3.5 10.4 12 3l8.5 7.4V20a1.5 1.5 0 0 1-1.5 1.5h-3.6v-5.3a1.4 1.4 0 0 0-1.4-1.4h-4a1.4 1.4 0 0 0-1.4 1.4v5.3H5A1.5 1.5 0 0 1 3.5 20v-9.6Z" />
    </svg>
  );

export const ClipboardCheckIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15" />
    <rect x="9" y="3" width="6" height="3.2" rx="1.1" />
    <path d="m9.6 13.4 1.8 1.8 3.6-3.6" />
  </svg>
);

export const ChartIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2 })} className={className}>
    <path d="M5.5 20V11.5" />
    <path d="M12 20V4.5" />
    <path d="M18.5 20v-6" />
  </svg>
);

export const GearIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.1 14.4a1.5 1.5 0 0 0 .3 1.65l.05.05a1.85 1.85 0 1 1-2.6 2.6l-.05-.05a1.5 1.5 0 0 0-2.55 1.07v.13a1.85 1.85 0 0 1-3.7 0v-.07a1.5 1.5 0 0 0-2.6-1.02l-.05.05a1.85 1.85 0 1 1-2.6-2.6l.05-.05A1.5 1.5 0 0 0 4.4 13.6h-.13a1.85 1.85 0 0 1 0-3.7h.07A1.5 1.5 0 0 0 5.4 5.35L5.35 5.3a1.85 1.85 0 1 1 2.6-2.6L8 2.75a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .92-1.37V1.6a1.85 1.85 0 0 1 3.7 0v.07a1.5 1.5 0 0 0 2.56 1.06l.05-.05a1.85 1.85 0 1 1 2.6 2.6l-.05.05a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.92h.13a1.85 1.85 0 0 1 0 3.7h-.07a1.5 1.5 0 0 0-1.37.9Z" />
  </svg>
);

export const CardIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.6" />
    <path d="M2.5 9.8h19" />
    <path d="M6 14.6h4" />
  </svg>
);

export const TrendUpIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2 })} className={className}>
    <path d="M4 16.5 9.5 11l3.2 3.2L20 7" />
    <path d="M15.4 7H20v4.6" />
  </svg>
);

export const FuelIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 21V5.5A2 2 0 0 1 6.5 3.5h5a2 2 0 0 1 2 2V21" />
    <path d="M3.5 21h11" />
    <path d="M6.8 7h4.4v3.4H6.8z" />
    <path d="M13.5 9.5h2.6a1.9 1.9 0 0 1 1.9 1.9v5.2a1.7 1.7 0 0 0 1.7 1.7 1.7 1.7 0 0 0 1.7-1.7V10l-2.2-3" />
  </svg>
);

export const PlusIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2.2 })} className={className}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const CloseIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, { strokeWidth: 2.2 })} className={className}>
    <path d="M17.5 6.5l-11 11M6.5 6.5l11 11" />
  </svg>
);

export const CalendarIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8.5 3.5v4M15.5 3.5v4" />
  </svg>
);

/* Stacked discs: the conventional shorthand for stored records, and it reads as
   layers, which is what the three-tier data path actually is. */
export const DatabaseIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" />
    <path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" />
    <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
  </svg>
);

/* Villages are places, so they get a map pin rather than the gear the Settings
   list used to borrow. A gear next to "Villages" implied configuration. */
export const MapPinIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);
