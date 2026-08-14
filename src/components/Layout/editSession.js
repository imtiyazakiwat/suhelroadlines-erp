import React from 'react';

/* =============================================================================
   Edit session — the iOS "Edit / Done" contract, lifted to the app shell.

   Apple's guidance is that a tab bar owns navigation and a toolbar owns actions
   for the current context, and that the two should not be stacked at the bottom
   of the same screen; when a tab bar is already present, contextual actions
   belong in the navigation bar. See
   https://developer.apple.com/forums/thread/790916

   So a screen that enters an editing state does not grow its own action bar
   over the content. It registers a session here and the nav bar takes over:
   Cancel on the leading edge, the commit action on the trailing edge, and a
   subtitle stating what is pending.

   Shape:
     { token, status, commitLabel, busy, onCommit, onCancel }

   `token` exists because RouteTransition keeps the outgoing screen mounted for
   a beat after the incoming one appears. Without it, the old screen's cleanup
   would run last and wipe the new screen's session. Clear with a functional
   update that checks the token still matches.
   ========================================================================== */

export const EditSessionContext = React.createContext(() => {});

/** Returns the setter. Accepts a session object, null, or an updater fn. */
export const useEditSession = () => React.useContext(EditSessionContext);

export default EditSessionContext;
