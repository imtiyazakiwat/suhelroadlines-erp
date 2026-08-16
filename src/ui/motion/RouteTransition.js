import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import './motion.css';

/* =============================================================================
   RouteTransition — iOS navigation transitions for react-router.

   Both views stay mounted for the length of the transition. That's what gives
   the push its continuity: the outgoing screen slides and dims behind the
   incoming one instead of vanishing.

   Direction is derived from the route hierarchy, not from history alone:

     push    going deeper (tab root -> detail)
     pop     coming back, or a browser/gesture Back
     switch  moving between sibling tabs, which have no hierarchy, so they
             cross-fade rather than travel

   The outgoing layer is inert (pointer-events: none) so a mid-transition tap
   can never hit the screen that's leaving.
   ========================================================================== */

/** Depth of each route. Siblings share a depth, so moving between them is a switch. */
const ROUTE_DEPTH = {
  '/': 0,
  '/str-status': 0,
  '/reports': 0,
  '/settings': 0,
  '/add-entry': 1,
  '/add-advance': 1,
  '/settings/vehicles': 1,
  '/settings/villages': 1
};

const depthOf = (pathname) => ROUTE_DEPTH[pathname] ?? 1;

const directionFor = (from, to, navigationType) => {
  if (!from || from === to) return null;

  const fromDepth = depthOf(from);
  const toDepth = depthOf(to);

  if (toDepth > fromDepth) return 'push';
  if (toDepth < fromDepth) return 'pop';

  // Same level: a real Back still reads as a pop, otherwise it's a tab switch.
  return navigationType === 'POP' ? 'pop' : 'switch';
};

const RouteTransition = ({ children }) => {
  const location = useLocation();
  const navigationType = useNavigationType();

  const [current, setCurrent] = useState({ key: location.pathname, node: React.isValidElement(children) ? React.cloneElement(children, { location }) : children });
  const [previous, setPrevious] = useState(null);
  const [direction, setDirection] = useState(null);

  const timerRef = useRef(null);

  useEffect(() => {
    // Same route, new children (data loaded, filters changed): swap in place.
    if (location.pathname === current.key) {
      setCurrent({ key: location.pathname, node: React.isValidElement(children) ? React.cloneElement(children, { location }) : children });
      return;
    }

    const nextDirection = directionFor(current.key, location.pathname, navigationType);

    setPrevious(current);
    setCurrent({ key: location.pathname, node: React.isValidElement(children) ? React.cloneElement(children, { location }) : children });
    setDirection(nextDirection);

    // Drop the outgoing layer once it has finished travelling.
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPrevious(null);
      setDirection(null);
    }, 460);
    // Only react to a route change; children updates are handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, children]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className={`rt26${direction ? ` rt26--${direction}` : ''}`}>
      {previous && (
        <div className="rt26__layer rt26__layer--exiting" key={previous.key} aria-hidden="true">
          {previous.node}
        </div>
      )}
      <div className="rt26__layer rt26__layer--entering" key={current.key}>
        {current.node}
      </div>
    </div>
  );
};

export default RouteTransition;
