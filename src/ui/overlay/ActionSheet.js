import React from 'react';
import { createPortal } from 'react-dom';
import GlassSurface from '../glass/GlassSurface';
import useOverlay from './useOverlay';
import './overlay.css';

/* =============================================================================
   ActionSheet and Alert.

   ActionSheet: two glass groups — the actions, then a detached Cancel — which
   is the layout iOS uses for destructive choices.
   Alert: centred glass card, stacked or side-by-side buttons depending on
   count. Replaces every window.confirm() in the app.
   ========================================================================== */

export const ActionSheet = ({ open, onClose, title, message, actions = [], cancelLabel = 'Cancel' }) => {
  const panelRef = useOverlay(open, onClose);

  if (!open || typeof document === 'undefined') return null;

  const run = (action) => {
    onClose?.();
    // Let the dismissal paint before the handler does its work.
    requestAnimationFrame(() => action.onSelect?.());
  };

  return createPortal(
    <div className="ovl26 ovl26--action" role="presentation">
      <button type="button" className="ovl26__scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />

      <div
        ref={panelRef}
        className="act26"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Actions'}
        tabIndex={-1}
      >
        <GlassSurface variant="regular" radius={16} className="act26__group">
          {(title || message) && (
            <div className="act26__header">
              {title && <p className="act26__title">{title}</p>}
              {message && <p className="act26__message">{message}</p>}
            </div>
          )}

          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`act26__item ${action.destructive ? 'is-destructive' : ''} ${
                action.disabled ? 'is-disabled' : ''
              }`.trim()}
              disabled={action.disabled}
              onClick={() => run(action)}
            >
              {action.label}
            </button>
          ))}
        </GlassSurface>

        <GlassSurface variant="regular" radius={16} className="act26__group act26__group--cancel">
          <button type="button" className="act26__item act26__item--cancel" onClick={onClose} data-autofocus>
            {cancelLabel}
          </button>
        </GlassSurface>
      </div>
    </div>,
    document.body
  );
};

export const Alert = ({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
  showCancel = true
}) => {
  const panelRef = useOverlay(open, onClose);

  if (!open || typeof document === 'undefined') return null;

  const confirm = () => {
    onClose?.();
    requestAnimationFrame(() => onConfirm?.());
  };

  return createPortal(
    <div className="ovl26 ovl26--alert" role="presentation">
      <button type="button" className="ovl26__scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />

      <GlassSurface variant="regular" radius={26} className="alr26">
        <div
          ref={panelRef}
          className="alr26__panel"
          role="alertdialog"
          aria-modal="true"
          aria-label={title || 'Alert'}
          tabIndex={-1}
        >
          <div className="alr26__content">
            {title && <h2 className="alr26__title">{title}</h2>}
            {message && <p className="alr26__message">{message}</p>}
          </div>

          <div className={`alr26__actions ${showCancel ? 'alr26__actions--pair' : ''}`.trim()}>
            {showCancel && (
              <button type="button" className="alr26__button" onClick={onClose}>
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              className={`alr26__button alr26__button--confirm ${destructive ? 'is-destructive' : ''}`.trim()}
              onClick={confirm}
              data-autofocus
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </GlassSurface>
    </div>,
    document.body
  );
};

export default ActionSheet;
