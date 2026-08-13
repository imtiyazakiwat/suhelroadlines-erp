import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GlassSurface from '../glass/GlassSurface';
import useOverlay from './useOverlay';
import './overlay.css';

/* =============================================================================
   Sheet — the iOS bottom sheet.

   - portalled to <body> so no ancestor overflow or transform can clip it
   - drag the grabber (or the header) down to dismiss, with a rubber-band feel
     and a velocity check, exactly like the system sheet
   - the panel is Liquid Glass; the scrim dims the content behind it
   - detent: 'medium' caps at ~60vh, 'large' at ~92vh, 'auto' fits content
   ========================================================================== */

const DETENTS = { auto: 'auto', medium: '60vh', large: '92vh' };
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.5;

const Sheet = ({
  open,
  onClose,
  title,
  subtitle,
  detent = 'auto',
  primaryAction = null,
  secondaryAction = null,
  showGrabber = true,
  dismissible = true,
  className = '',
  children
}) => {
  const panelRef = useOverlay(open, onClose);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef({ startY: 0, startTime: 0, active: false });

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
    }
  }, [open]);

  const onPointerDown = useCallback(
    (event) => {
      if (!dismissible) return;
      gesture.current = { startY: event.clientY, startTime: Date.now(), active: true };
      setDragging(true);
    },
    [dismissible]
  );

  const onPointerMove = useCallback((event) => {
    if (!gesture.current.active) return;
    const delta = event.clientY - gesture.current.startY;
    // Resist upward drag — the sheet is already at its detent.
    setDragY(delta > 0 ? delta : delta * 0.2);
  }, []);

  const onPointerUp = useCallback(
    (event) => {
      if (!gesture.current.active) return;
      const delta = event.clientY - gesture.current.startY;
      const elapsed = Math.max(1, Date.now() - gesture.current.startTime);
      const velocity = delta / elapsed;

      gesture.current.active = false;
      setDragging(false);

      if (delta > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) onClose?.();
      else setDragY(0);
    },
    [onClose]
  );

  if (!open || typeof document === 'undefined') return null;

  const maxHeight = DETENTS[detent] || DETENTS.auto;

  return createPortal(
    <div className="ovl26" role="presentation">
      <button
        type="button"
        className="ovl26__scrim"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => dismissible && onClose?.()}
      />

      <GlassSurface
        variant="regular"
        radius={38}
        className={`sht26 ${dragging ? 'is-dragging' : ''} ${className}`.trim()}
        style={{
          transform: dragY ? `translate3d(0, ${dragY}px, 0)` : undefined,
          maxHeight
        }}
      >
        <div
          ref={panelRef}
          className="sht26__panel"
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : 'Sheet'}
          tabIndex={-1}
        >
          <div
            className="sht26__grip"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {showGrabber && <span className="sht26__grabber" aria-hidden="true" />}

            {(title || secondaryAction || primaryAction) && (
              <div className="sht26__head">
                <div className="sht26__head-side">{secondaryAction}</div>
                <div className="sht26__titles">
                  {title && <h2 className="sht26__title">{title}</h2>}
                  {subtitle && <p className="sht26__subtitle">{subtitle}</p>}
                </div>
                <div className="sht26__head-side sht26__head-side--end">{primaryAction}</div>
              </div>
            )}
          </div>

          <div className="sht26__body">{children}</div>
        </div>
      </GlassSurface>
    </div>,
    document.body
  );
};

export default Sheet;
