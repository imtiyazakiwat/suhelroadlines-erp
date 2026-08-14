import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GlassSurface from '../glass/GlassSurface';
import './overlay.css';

/* =============================================================================
   Toast — a glass capsule that drops in from the top, like the iOS 26 system
   notifications. Provider-based so any screen can call toast() without
   threading state through props.
   ========================================================================== */

const ToastContext = createContext(() => {});

const TONE_ICON = {
  success: (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
      <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
      <path d="M17 7 7 17M7 7l10 10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  ),
  info: null
};

let seq = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message, options = {}) => {
      // `action` is an optional { label, onClick }. It exists so a toast can be
      // actionable rather than merely informative — "a new version is ready"
      // with nothing to tap is a notice the user cannot act on.
      const { tone = 'info', duration = 2600, action = null } =
        typeof options === 'string' ? { tone: options } : options;
      const id = (seq += 1);

      setToasts((current) => [...current.slice(-2), { id, message, tone, action }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );

      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => Object.assign(toast, {
      success: (message, options) => toast(message, { ...options, tone: 'success' }),
      error: (message, options) => toast(message, { ...options, tone: 'error' }),
      dismiss
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="tst26__stack" role="status" aria-live="polite">
            {toasts.map((item) => (
              <GlassSurface
                key={item.id}
                variant="regular"
                capsule
                className={`tst26 tst26--${item.tone}`}
                onClick={() => dismiss(item.id)}
              >
                {TONE_ICON[item.tone] && <span className="tst26__icon">{TONE_ICON[item.tone]}</span>}
                <span className="tst26__text">{item.message}</span>
                {item.action && (
                  <button
                    type="button"
                    className="tst26__action"
                    onClick={(event) => {
                      // The capsule itself dismisses on click, so the action must
                      // not let the event reach it — otherwise the toast vanishes
                      // and the handler's own reload races the unmount.
                      event.stopPropagation();
                      dismiss(item.id);
                      item.action.onClick?.();
                    }}
                  >
                    {item.action.label}
                  </button>
                )}
              </GlassSurface>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

export default ToastProvider;
