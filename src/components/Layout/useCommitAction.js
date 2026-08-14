import { useCallback, useEffect, useRef } from 'react';
import { useEditSession } from './editSession';

/* =============================================================================
   useCommitAction — lends this screen's commit pair to the nav bar.

   Use this instead of pinning an action bar above the tab dock. The tab bar
   already owns the bottom edge, and stacking a second bar of actions there is
   what Apple warns against; with a tab bar present, contextual actions belong
   in the navigation bar.

   Handlers are read through a ref, so the identities handed to the session are
   permanently stable. If they changed per render the effect would re-register
   on every render and spin.
   ========================================================================== */

const useCommitAction = ({
  token,
  active = true,
  status = null,
  commitLabel = 'Save',
  cancelLabel = 'Cancel',
  busy = false,
  disabled = false,
  onCommit,
  onCancel
}) => {
  const setEditSession = useEditSession();

  const handlers = useRef({});
  handlers.current = { onCommit, onCancel };

  const commit = useCallback(() => handlers.current.onCommit?.(), []);
  const cancel = useCallback(() => handlers.current.onCancel?.(), []);

  useEffect(() => {
    if (!active) return undefined;

    setEditSession({
      token,
      status,
      commitLabel,
      cancelLabel,
      busy,
      disabled,
      onCommit: commit,
      onCancel: cancel
    });

    // Clear only our own session. RouteTransition keeps the outgoing screen
    // mounted for a beat, so its cleanup runs after the incoming screen has
    // already registered — without the token check it would wipe it.
    return () => setEditSession((current) => (current?.token === token ? null : current));
  }, [
    active,
    token,
    status,
    commitLabel,
    cancelLabel,
    busy,
    disabled,
    commit,
    cancel,
    setEditSession
  ]);
};

export default useCommitAction;
