import { useEffect, useRef, useState } from 'react';

/* =============================================================================
   useOverlay — shared behaviour for Sheet, ActionSheet and Alert.

   Overlays nest for real: a Picker opens a sheet from inside an editor sheet,
   and a destructive row opens an Alert over both. So this keeps a stack and
   gives the topmost overlay exclusive control. Without that:

     - Escape collapsed the whole stack, because every open overlay had its own
       capture-phase listener on `document` and `stopPropagation()` does not stop
       sibling listeners on the same node.
     - Every overlay ran its own focus trap, so the background sheet would yank
       focus back out of the foreground one whenever the active element happened
       to match its first or last focusable.
     - All overlays shared `--z-sheet`, so stacking came down to portal mount
       order. Nothing enforced that the newest overlay was on top.
   ========================================================================== */

let stack = [];
let nextId = 1;

/* ------------------------------------------------------------- scroll lock */

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
 * @returns {{ panelRef: React.RefObject, depth: number }}
 *   panelRef — attach to the overlay panel for focus handling
 *   depth    — 0 for the first overlay, 1 for one opened on top of it, and so
 *              on. Drives the z-index and the nested-scrim treatment.
 */
export const useOverlay = (open, onClose, options = {}) => {
  const { lock = true, escape = true, trapFocus = true } = options;
  const panelRef = useRef(null);
  const restoreFocusTo = useRef(null);
  const idRef = useRef(0);
  const [depth, setDepth] = useState(0);

  // Register in the stack first, so the handlers below can ask whether they are
  // the topmost overlay. Declared before them, so it runs before them.
  useEffect(() => {
    if (!open) return undefined;

    const id = nextId;
    nextId += 1;
    idRef.current = id;
    stack.push(id);
    setDepth(stack.length - 1);

    return () => {
      stack = stack.filter((entry) => entry !== id);
      idRef.current = 0;
    };
  }, [open]);

  // Asked at event time rather than captured in state: an overlay opening on
  // top of this one does not re-render it, so a stored flag would go stale.
  const isTopmost = () => stack.length > 0 && stack[stack.length - 1] === idRef.current;

  // Body scroll lock, reference counted so stacked overlays don't fight.
  useEffect(() => {
    if (!open || !lock) return undefined;
    lockScroll();
    return unlockScroll;
  }, [open, lock]);

  // Escape closes the topmost overlay only; Tab cycles inside it.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (!isTopmost()) return;

      if (escape && event.key === 'Escape') {
        event.preventDefault();
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
    // isTopmost reads refs and module state, so it needs no dependency entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, escape, trapFocus]);

  // Move focus in on open, back out on close.
  useEffect(() => {
    if (!open) return undefined;

    restoreFocusTo.current = document.activeElement;
    const timer = setTimeout(() => {
      const panel = panelRef.current;
      // Don't steal focus if something else has since opened above us.
      if (!panel || !isTopmost()) return;
      const target = panel.querySelector('[data-autofocus]') || panel;
      target.focus?.({ preventScroll: true });
    }, 60);

    return () => {
      clearTimeout(timer);
      restoreFocusTo.current?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { panelRef, depth };
};

export default useOverlay;
