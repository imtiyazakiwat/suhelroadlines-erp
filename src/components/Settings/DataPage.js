import React, { useCallback, useEffect, useState } from 'react';
import {
  ListSection,
  ListRow,
  Skeleton,
  Alert,
  useToast
} from '../../ui';
import { getDataFootprint, pruneRecords, pruneAllData } from '../../services/dataService';
import './SettingsPage.css';

/* =============================================================================
   Data — pushed from /settings.

   The screen's job: show how much is stored, and delete it.

   Modelled on Settings > General > Transfer or Reset iPhone, which is the closest
   first-party equivalent: a plain list of counts, then reset options at the
   bottom in red, on a screen you have to navigate to on purpose. It is a pushed
   route rather than a sheet on Settings for the same reason Vehicles is — there
   is no way to stack two confirmations inside a sheet without the overlay
   problems §3b describes.

   Every element, and why:

   - **Counts, one row per record type.** The question anyone opening this screen
     has is "how much am I about to lose". A single total would hide the answer
     that matters: 200 trips and 4 vehicles is a very different decision from the
     reverse. A count that could not be read shows "Unavailable" rather than 0,
     because on a screen whose next button is irreversible those two must never
     look the same.
   - **"Delete trips and advances" above "Delete all data".** Order is an
     argument about priority: clearing a season's records while keeping the fleet
     is the routine operation, and the total wipe is the exception. Putting the
     narrower action first also means the thumb reaches it before the wider one.
   - **Two confirmations for the total wipe, one for the narrower.** The rule in
     this app is that destructive actions confirm; the difference here is that
     this one cannot be undone, there are no backups, and it lands on every
     device sharing the database rather than only this one. Apple double-confirms
     Erase All Content and Settings for the same reason.
   - **No "export first" shortcut.** It would be the right thing to offer, but
     Reports already owns CSV export and duplicating it here would put a second
     copy of that logic behind a screen nobody visits. The footer points at it
     instead.

   What is deliberately absent: a progress bar (the operation is a handful of
   batched deletes, and a fake progress animation would be inventing detail),
   and per-collection checkboxes (four independent switches make sixteen outcomes
   to describe, when only two are ever wanted).
   ========================================================================== */

const DataPage = () => {
  const toast = useToast();

  const [footprint, setFootprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 'records' | 'all' for the first confirmation, then 'all-final' for the
  // second. Separate states rather than one flag, so the second alert cannot be
  // reached without the first.
  const [confirming, setConfirming] = useState(null);
  const [confirmingFinal, setConfirmingFinal] = useState(false);

  const load = useCallback(async () => {
    try {
      setFootprint(await getDataFootprint());
    } catch (error) {
      console.error('Error reading data footprint:', error);
      toast.error('Could not read what is stored');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** "Unavailable", never "0", when the read failed. */
  const countText = (value, noun) => {
    if (value === null || value === undefined) return 'Unavailable';
    return `${value} ${value === 1 ? noun : `${noun}s`}`;
  };

  const describe = (keys) => {
    const parts = keys
      .map(([value, noun]) => (value ? `${value} ${value === 1 ? noun : `${noun}s`}` : null))
      .filter(Boolean);
    if (!parts.length) return 'nothing';
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  };

  const run = async (scope) => {
    setBusy(true);
    try {
      const { failed } = scope === 'all' ? await pruneAllData() : await pruneRecords();

      if (failed.length) {
        // Naming what survived matters more than a generic failure: the user has
        // to know the book is now half-deleted.
        toast.error(`Some data could not be deleted: ${failed.join(', ')}`);
      } else {
        toast.success(scope === 'all' ? 'All data deleted' : 'Trips and advances deleted');
      }

      await load();
    } catch (error) {
      console.error('Error pruning data:', error);
      toast.error(error?.message || 'Could not delete the data');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="set">
        <div className="set__skeleton">
          <Skeleton height={176} radius="var(--r-lg)" />
          <Skeleton height={88} radius="var(--r-lg)" />
        </div>
      </div>
    );
  }

  const recordsSummary = describe([
    [footprint?.trips, 'trip'],
    [footprint?.advances, 'advance']
  ]);

  const everythingSummary = describe([
    [footprint?.trips, 'trip'],
    [footprint?.advances, 'advance'],
    [footprint?.vehicles, 'vehicle'],
    [footprint?.villages, 'village']
  ]);

  return (
    <div className="set">
      <ListSection
        header="Stored"
        footer="Records are held in Firestore with a Realtime Database cache in front of it, and are shared by every device signed in to this app."
      >
        <ListRow title="Trips" value={countText(footprint?.trips, 'trip')} />
        <ListRow title="Advances" value={countText(footprint?.advances, 'advance')} />
        <ListRow title="Vehicles" value={countText(footprint?.vehicles, 'vehicle')} />
        <ListRow title="Villages" value={countText(footprint?.villages, 'village')} />
      </ListSection>

      <ListSection
        header="Reset"
        footer="Deleting cannot be undone and there is no backup. Export what you need from Reports first."
      >
        <ListRow
          title="Delete Trips & Advances"
          subtitle="Keeps vehicles and villages"
          destructive
          onClick={() => !busy && setConfirming('records')}
        />
        <ListRow
          title="Delete All Data"
          subtitle="Trips, advances, vehicles and villages"
          destructive
          onClick={() => !busy && setConfirming('all')}
        />
      </ListSection>

      <Alert
        open={confirming === 'records'}
        onClose={() => setConfirming(null)}
        title="Delete trips and advances?"
        message={`This deletes ${recordsSummary} on every device. Vehicles and villages are kept. It cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => run('records')}
      />

      <Alert
        open={confirming === 'all'}
        onClose={() => setConfirming(null)}
        title="Delete all data?"
        message={`This deletes ${everythingSummary} on every device, leaving the app empty.`}
        confirmLabel="Continue"
        destructive
        onConfirm={() => setConfirmingFinal(true)}
      />

      {/* Second confirmation. Worded as the consequence rather than the action,
          because by this point the user has already read what it does and the
          only new information is that there is no way back. */}
      <Alert
        open={confirmingFinal}
        onClose={() => setConfirmingFinal(false)}
        title="This cannot be undone"
        message="There is no backup and no undo. Every trip, advance, vehicle and village will be gone."
        confirmLabel="Delete Everything"
        destructive
        onConfirm={() => {
          setConfirmingFinal(false);
          run('all');
        }}
      />
    </div>
  );
};

export default DataPage;
