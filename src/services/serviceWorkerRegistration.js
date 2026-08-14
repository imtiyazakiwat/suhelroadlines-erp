/* =============================================================================
   Service worker registration
   -----------------------------------------------------------------------------
   Registration is deliberately NOT fire-and-forget. Two behaviours matter:

   1. An update must be offered, not forced. Reloading under someone who is
      mid-form would lose typed work, and this app's own rule is that a failed or
      interrupted save must never discard input. So a waiting worker raises
      `onUpdateReady` and the UI asks.

   2. Registration only happens in a production build over a secure origin.
      In `npm start` a service worker caches the dev bundle and then serves it
      after you have edited the source, which presents as "my change did nothing".
   ========================================================================== */

const SW_URL = '/service-worker.js';

const isLocalhost = () =>
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export const canRegister = () =>
  'serviceWorker' in navigator &&
  process.env.NODE_ENV === 'production' &&
  (window.isSecureContext || isLocalhost());

/**
 * @param {object}   [handlers]
 * @param {Function} [handlers.onUpdateReady] Called with `applyUpdate` once a new
 *   worker is installed and waiting. Invoke it to activate and reload.
 */
export const registerServiceWorker = ({ onUpdateReady } = {}) => {
  if (!canRegister()) return;

  // Registering after `load` keeps the worker's own fetches out of the critical
  // path for the first paint.
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(SW_URL);

      const promote = (worker) => () => {
        if (!worker) return;
        worker.postMessage('SKIP_WAITING');
        // controllerchange fires once the new worker takes over; reloading then
        // (rather than immediately) guarantees the reload is served by the new
        // worker instead of racing it.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
      };

      // Already waiting from a previous visit.
      if (registration.waiting && navigator.serviceWorker.controller) {
        onUpdateReady?.(promote(registration.waiting));
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // `controller` is null on the very first install — that is a fresh
          // cache, not an update, and prompting then would be nonsense.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdateReady?.(promote(registration.waiting || installing));
          }
        });
      });
    } catch (error) {
      // A failed registration must never break the app; it only costs offline
      // launch. Firebase and fastSync are unaffected.
      console.warn('Service worker registration failed:', error?.message || error);
    }
  });
};

export default registerServiceWorker;
