/* =============================================================================
   dataService — counting and pruning stored data.

   This exists because there was no way to get rid of anything in bulk. The
   project was seeded with mock records to get the screens working, and short of
   opening the Firebase console there was no route back to an empty book.

   Deleting has to happen in all four places the app keeps data, in this order,
   or the records come back:

     1. Firestore        the system of record
     2. RTDB /cache      the shared cache, which every device reads first
     3. RTDB /outbox     queued writes — `flushOutbox` would otherwise faithfully
                         re-promote exactly what was just deleted
     4. memory + sessionStorage + localStorage   this device's copies

   Steps 2-4 are `fastSync.clearCollection` plus the localStorage keys. Firestore
   goes first because it is the one that cannot be rebuilt from the others: if the
   run fails halfway, the caches are stale rather than the record being resurrected
   from a cache into an empty Firestore.

   Nothing here is reversible and there are no backups, so both entry points
   report what they are about to do by count, and the caller confirms.
   ========================================================================== */

import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db, isFirebaseAvailable } from '../firebase/config';
import fastSync from './fastSync';
import {
  COLLECTIONS,
  tripService,
  advanceService,
  vehicleService,
  villageService
} from './firebaseService';
import { clearAllLocalData, LOCAL_STORAGE_KEYS } from './localStorageService';

/* Firestore caps a batch at 500 operations. 400 leaves headroom and keeps each
   commit small enough that a failure loses one chunk, not the whole run. */
const BATCH_LIMIT = 400;

/**
 * What gets deleted together, and why these two groups.
 *
 * `records` is the day-to-day book: trips, the advance ledger, and the per-trip
 * advance summaries that are derived from it. Deleting a trip while keeping its
 * advances would leave orphans that still count towards every report total, so
 * the three move as one.
 *
 * `fleet` is the reference data the pickers are built from. It is separate
 * because clearing a year of trips at the end of a season is a routine thing to
 * want, and having to re-enter every vehicle and village afterwards would make
 * nobody do it.
 */
export const DATA_GROUPS = {
  records: [COLLECTIONS.TRIPS, COLLECTIONS.ADVANCES, COLLECTIONS.TRIP_ADVANCES],
  fleet: [COLLECTIONS.VEHICLES, COLLECTIONS.VILLAGES]
};

/** Collections whose local-storage fallback copy must go with them. */
const LOCAL_KEY_FOR = {
  [COLLECTIONS.TRIPS]: LOCAL_STORAGE_KEYS.TRIPS,
  [COLLECTIONS.ADVANCES]: LOCAL_STORAGE_KEYS.ADVANCES,
  [COLLECTIONS.VEHICLES]: LOCAL_STORAGE_KEYS.VEHICLES,
  [COLLECTIONS.VILLAGES]: LOCAL_STORAGE_KEYS.VILLAGES
};

/**
 * Counts for the confirmation copy.
 *
 * Read through the normal services, so this costs nothing: all four come from
 * the fastSync cache the rest of the app is already using. Inactive vehicles and
 * villages are included, because a delete does not spare them and a count that
 * quietly excluded them would understate what is about to happen.
 *
 * A failed read reports `null` rather than 0 — "0 trips" and "we could not
 * check" must not look the same on a screen whose next button is irreversible.
 */
export const getDataFootprint = async () => {
  const [trips, advances, vehicles, villages] = await Promise.allSettled([
    tripService.getAllTrips(),
    advanceService.getAllAdvances(),
    vehicleService.getAllVehicles(true),
    villageService.getAllVillages(true)
  ]);

  const count = (result) =>
    result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.length : null;

  return {
    trips: count(trips),
    advances: count(advances),
    vehicles: count(vehicles),
    villages: count(villages)
  };
};

/** Delete every document in one Firestore collection, in chunks. */
const deleteEveryDoc = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  const docs = snapshot.docs;

  for (let index = 0; index < docs.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db);
    docs.slice(index, index + BATCH_LIMIT).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }

  return docs.length;
};

/**
 * Prune the named collections everywhere.
 *
 * Resolves with `{ deleted: { <collection>: n }, failed: [<collection>] }`.
 * Collections are done one at a time rather than in parallel: a partial failure
 * then has an obvious shape ("advances went, trips did not") instead of an
 * arbitrary interleaving, and the caches for anything that did succeed are
 * already consistent.
 */
export const pruneCollections = async (collectionNames = []) => {
  const deleted = {};
  const failed = [];

  for (const name of collectionNames) {
    try {
      // 1. Firestore. Skipped rather than failed when Firestore is unavailable:
      //    the local copy is then the only copy, and clearing it is still the
      //    delete the user asked for.
      deleted[name] = isFirebaseAvailable && db ? await deleteEveryDoc(name) : 0;

      // 2 + 3 + part of 4. Memory, session snapshot, RTDB cache and outbox.
      await fastSync.clearCollection(name);

      // 4. The local-storage fallback copy, where one exists.
      if (LOCAL_KEY_FOR[name]) clearAllLocalData([LOCAL_KEY_FOR[name]]);
    } catch (error) {
      console.error(`Error pruning ${name}:`, error);
      failed.push(name);
    }
  }

  return { deleted, failed };
};

/** Trips, advances and advance summaries. Vehicles and villages are kept. */
export const pruneRecords = () => pruneCollections(DATA_GROUPS.records);

/** Everything: the book and the fleet. */
export const pruneAllData = () =>
  pruneCollections([...DATA_GROUPS.records, ...DATA_GROUPS.fleet]);

const dataService = {
  getDataFootprint,
  pruneCollections,
  pruneRecords,
  pruneAllData,
  DATA_GROUPS
};

export default dataService;
