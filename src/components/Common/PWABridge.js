import { useEffect } from 'react';
import { useToast } from '../../ui';
import { registerServiceWorker } from '../../services/serviceWorkerRegistration';
import { retryOutbox } from '../../services/firebaseService';

/* =============================================================================
   PWABridge — the standalone-mode behaviours the app cannot express in CSS
   -----------------------------------------------------------------------------
   Renders nothing. Mounted once, inside ToastProvider so it can talk to the
   user, and inside Router-independent scope because none of this is per-route.

   It owns four things, each of which is a real difference between a web page and
   an installed app:

   1. `display-mode` as a class on <html>.
      Installed and in-browser are genuinely different products: in the browser
      the user has a reload button, a back gesture and an address bar; installed
      they have none of those. Screens that need to compensate can key off
      `.is-standalone` instead of each re-sniffing the environment.

   2. Connectivity as a class, and only as a class.
      `navigator.onLine` is famously weak — it reports link state, not
      reachability — so it is used for presentation only and never to decide
      whether a write may proceed. Writes still go through fastSync's outbox,
      which is the honest signal.

   3. Outbox retry on reconnect and on resume.
      This is the substantive one. A standalone app is suspended and resumed, not
      reloaded, so `firebaseService`'s once-per-start flush may never run again
      for days. Without this, a trip saved in a dead zone stays local
      indefinitely — the "silent split-brain" risk in CONTEXT.md §6.

   4. The update prompt.
      Offered, never forced: a reload under a half-filled Add Trip form would
      destroy typed work, which this app treats as unacceptable.
   ========================================================================== */

const STANDALONE_QUERY = '(display-mode: standalone)';

/** True when launched from the Home Screen.
 *  `navigator.standalone` is the iOS-only legacy signal and is still the
 *  reliable one on older iOS, where `display-mode` was not implemented; the
 *  media query covers everything current. Both are checked. */
export const isStandalone = () =>
  window.navigator.standalone === true ||
  (typeof window.matchMedia === 'function' && window.matchMedia(STANDALONE_QUERY).matches);

const PWABridge = () => {
  const toast = useToast();

  /* ---- display mode ---- */
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.classList.toggle('is-standalone', isStandalone());
    apply();

    // A browser tab can become an installed window without a reload, so this is
    // watched rather than read once.
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(STANDALONE_QUERY);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /* ---- connectivity + outbox retry ---- */
  useEffect(() => {
    const root = document.documentElement;
    let wasOffline = !navigator.onLine;

    const paint = () => root.classList.toggle('is-offline', !navigator.onLine);
    paint();

    const onOnline = () => {
      paint();
      // Only speak if the user actually saw the offline state. Announcing
      // "back online" to someone who never went offline is noise.
      if (wasOffline) toast.success('Back online. Syncing…', { duration: 2200 });
      wasOffline = false;
      retryOutbox();
    };

    const onOffline = () => {
      wasOffline = true;
      paint();
      // Honest wording: work is kept, not lost, and not yet synced.
      toast('Offline. Changes are saved on this device.', { tone: 'warning', duration: 3200 });
    };

    // Resume, not reload: this is the standalone lifecycle. A suspended app that
    // regains the foreground never fires `online`, so visibility is the hook.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) retryOutbox();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [toast]);

  /* ---- service worker ---- */
  useEffect(() => {
    registerServiceWorker({
      onUpdateReady: (applyUpdate) => {
        toast('A new version is ready.', {
          duration: 10000,
          action: { label: 'Update', onClick: applyUpdate }
        });
      }
    });
  }, [toast]);

  return null;
};

export default PWABridge;
