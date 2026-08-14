import React from 'react';
import {
  CANVAS,
  COLOR,
  ROAD_CURVE,
  ROAD_WIDTH,
  DASH_WIDTH,
  DASH_ARRAY,
  SUN
} from '../../brand/artwork';

/* =============================================================================
   AppMark — the brand mark, in the app
   -----------------------------------------------------------------------------
   WHY: the nav bar used a text monogram ("SR") while the Home Screen icon was
   Create React App's React logo, so the app had two identities and neither was
   its own. This renders the *same geometry* as the icon, imported from
   src/brand/artwork.js rather than re-drawn, so the thing on the Home Screen and
   the thing in the nav bar cannot diverge.

   WHY A `detail` PROP: the nav avatar is 34px. At that size the seven centre
   dashes are each about half a pixel and turn into grey mush on the white road,
   which reads as a rendering artefact rather than as detail. So below ~44px the
   dashes are dropped and only the road and sun are drawn. This is the same
   judgement Apple applies with SF Symbols scales — the small size is a different
   drawing, not the large one scaled down.

   COST: inline SVG, four elements, no network request and no extra file to keep
   in sync. Gradient ids are namespaced per instance so two marks on one screen
   cannot capture each other's fills.
   ========================================================================== */

let seq = 0;

const AppMark = ({ size = 34, label, className = '', ...rest }) => {
  // One stable id per mounted instance.
  const p = React.useMemo(() => `am${(seq += 1)}-`, []);

  // Threshold, not a magic number: below this the dash stroke is under ~0.5
  // device px at 2x and cannot render honestly.
  const detail = size >= 44;

  // A mark with no label is decoration and must be hidden from assistive tech;
  // one with a label is content and gets a role. Never both.
  const a11y = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': 'true', focusable: 'false' };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      className={`appmark ${className}`.trim()}
      {...a11y}
      {...rest}
    >
      <defs>
        <linearGradient
          id={`${p}plate`}
          gradientUnits="userSpaceOnUse"
          x1="327.68"
          y1="0"
          x2="696.32"
          y2={CANVAS}
        >
          <stop offset="0" stopColor={COLOR.plateTop} />
          <stop offset="1" stopColor={COLOR.plateBottom} />
        </linearGradient>
        <linearGradient
          id={`${p}sun`}
          gradientUnits="userSpaceOnUse"
          x1={SUN.cx}
          y1={SUN.cy - SUN.r}
          x2={SUN.cx}
          y2={SUN.cy + SUN.r}
        >
          <stop offset="0" stopColor={COLOR.sunTop} />
          <stop offset="1" stopColor={COLOR.sunBottom} />
        </linearGradient>
      </defs>

      {/* The plate is a circle here, not the icon's squircle: in the nav bar this
          sits next to circular controls, and iOS uses circles for identity
          badges in a bar. The icon keeps the squircle because that is the Home
          Screen's shape language. */}
      <circle cx="512" cy="512" r="512" fill={`url(#${p}plate)`} />
      <circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill={`url(#${p}sun)`} />
      <path
        d={ROAD_CURVE}
        fill="none"
        stroke={COLOR.road}
        strokeWidth={ROAD_WIDTH}
        strokeLinecap="round"
      />
      {detail && (
        <path
          d={ROAD_CURVE}
          fill="none"
          stroke={`url(#${p}plate)`}
          strokeWidth={DASH_WIDTH}
          strokeDasharray={DASH_ARRAY}
        />
      )}
    </svg>
  );
};

export default AppMark;
