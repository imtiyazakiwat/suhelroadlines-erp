import { useEffect, useRef } from 'react';

/* =============================================================================
   Shared overlay behaviour: scroll lock, Escape to dismiss, focus containment.
   Every overlay in the app routes through this so they behave identically.
   ========================================================================== */

let lockCount = 0;
let savedTop = 0;

const lockScroll = () => {
  lockCount += 1;
  if (lockCount > 1) return;

  savedTop = window.scrollY || document.documentElement.scrollTop || 0;
  const { style } = document.body;
  style.position = 'fixed';
  style.top = `${-savedTop}px`;
  style.left = '0';
  style.right = '0';
  style.width = '100%';
  style.overflow = 'hidden';
};

const unlockScroll = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  const { style } = document.body;
  style.position = '';
  style.top = '';
  style.left = '';
  style.right = '';
  style.width = '';
  style.overflow = '';
  window.scrollTo(0, savedTop);
};

/**
 * @param {boolean}  open
 * @param {Function} onClose
 * @param {object}  [options] { lock = true, escape = true, trapFocus = true }
 * @returns {React.RefObject} attach to the overlay panel for focus handling
 */
export const useOverlay = (open, onClose, options = {}) => {
  const { lock = true, escape = true, trapFocus = true } = options;
  const panelRef = useRef(null);
  const restoreFocusTo = useRef(null);

  // Body scroll lock, reference counted so stacked overlays don't fight.
  useEffect(() => {
    if (!open || !lock) return undefined;
    lockScroll();
    return unlockScroll;
  }, [open, lock]);

  // Escape closes; Tab cycles inside the panel.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (escape && event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (!trapFocus || event.key !== 'Tab' || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose, escape, trapFocus]);

  // Move focus in on open, back out on close.
  useEffect(() => {
    if (!open) return undefined;

    restoreFocusTo.current = document.activeElement;
    const timer = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector('[data-autofocus]') || panel;
      target.focus?.({ preventScroll: true });
    }, 60);

    return () => {
      clearTimeout(timer);
      restoreFocusTo.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return panelRef;
};

export default useOverlay;
