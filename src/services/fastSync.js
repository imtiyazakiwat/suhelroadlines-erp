/* =============================================================================
   fastSync — three-tier data path so the UI never waits on Firestore.

     tier 1  in-memory map        ~0 ms    what the UI renders from
     tier 2  Realtime Database    ~50-150 ms  shared cache + write-ahead log
     tier 3  Firestore            ~300-900 ms system of record

   WRITES (write-ahead, then promote):
     1. patch memory + notify subscribers                -> UI updates instantly
     2. set /cache/<col>/<id>  and  /outbox/<col>/<id>   -> other devices see it
     3. write Firestore
     4. on success delete /outbox/<col>/<id>  (cache entry stays as cache)
        on failure the outbox entry survives and is retried by flushOutbox()

   READS (stale-while-revalidate):
     memory -> RTDB cache -> Firestore, and whatever Firestore returns is
     written back to both lower tiers.

   Firestore keeps a persistent multi-tab local cache too (see firebase/config),
   so step 3 also resolves from disk immediately when offline.
   ========================================================================== */

import { ref, get, set, update, remove, onValue, off } from 'firebase/database';
import { rtdb, isRealtimeAvailable } from '../firebase/config';

const CACHE_ROOT = 'cache';
const OUTBOX_ROOT = 'outbox';
const SESSION_PREFIX = 'srl_fast_';

/** collection -> array of records */
const memory = new Map();
/** collection -> Set<callback> */
const listeners = new Map();
/** collections with a live RTDB subscription */
const subscribed = new Set();
/** collection -> in-flight revalidation promise (dedupes concurrent reads) */
const inFlight = new Map();

const canUseRtdb = () => Boolean(rtdb) && isRealtimeAvailable;

/* ------------------------------- serialising ------------------------------ */

/**
 * RTDB accepts only JSON primitives: no Date, no Firestore Timestamp,
 * no undefined. Dates become ISO strings (every consumer already handles
 * both shapes via `toDate`).
 */
export const serialize = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (e) {
      return null;
    }
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      const clean = serialize(val);
      if (clean !== undefined) out[key] = clean;
    });
    return out;
  }
  if (typeof value === 'number' && !isFinite(value)) return null;
  return value;
};

const toArray = (snapshotValue) => {
  if (!snapshotValue || typeof snapshotValue !== 'object') return [];
  return Object.entries(snapshotValue).map(([id, record]) => ({ ...record, id }));
};

/* --------------------------- session snapshot ----------------------------- */
// Survives a page reload so the first paint after refresh has data with no
// network at all. Kept small and best-effort; failures are ignored.

const readSession = (collection) => {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + collection);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const writeSession = (collection, records) => {
  try {
    sessionStorage.setItem(SESSION_PREFIX + collection, JSON.stringify(records));
  } catch (e) {
    /* quota or private mode — non-fatal */
  }
};

/* -------------------------------- notify ---------------------------------- */

const notify = (collection) => {
  const records = memory.get(collection) || [];
  (listeners.get(collection) || new Set()).forEach((cb) => {
    try {
      cb(records);
    } catch (e) {
      console.warn('fastSync listener failed:', e);
    }
  });
};

const setMemory = (collection, records) => {
  memory.set(collection, records);
  writeSession(collection, records);
  notify(collection);
};

export const getMemory = (collection) =>
  memory.get(collection) || readSession(collection) || null;

/* ------------------------------ subscriptions ----------------------------- */

/**
 * Live RTDB listener for a collection. Any device that writes through
 * fastSync shows up here within RTDB latency.
 */
const ensureSubscription = (collection) => {
  if (!canUseRtdb() || subscribed.has(collection)) return;
  subscribed.add(collection);

  const collectionRef = ref(rtdb, `${CACHE_ROOT}/${collection}`);
  onValue(
    collectionRef,
    (snapshot) => {
      const records = toArray(snapshot.val());
      if (records.length) setMemory(collection, records);
    },
    (error) => {
      console.warn(`fastSync: RTDB listener for ${collection} failed:`, error.message);
      subscribed.delete(collection);
    }
  );
};

export const subscribeCollection = (collection, callback) => {
  if (!listeners.has(collection)) listeners.set(collection, new Set());
  listeners.get(collection).add(callback);
  ensureSubscription(collection);

  const current = getMemory(collection);
  if (current) callback(current);

  return () => {
    listeners.get(collection)?.delete(callback);
  };
};

export const stopAll = () => {
  if (!canUseRtdb()) return;
  subscribed.forEach((collection) => off(ref(rtdb, `${CACHE_ROOT}/${collection}`)));
  subscribed.clear();
};

/* ---------------------------------- read ---------------------------------- */

const primeRtdb = (collection, records) => {
  if (!canUseRtdb() || !records.length) return;
  const payload = {};
  records.forEach((record) => {
    if (!record?.id) return;
    const { id, ...rest } = record;
    payload[id] = serialize(rest);
  });
  set(ref(rtdb, `${CACHE_ROOT}/${collection}`), payload).catch((error) =>
    console.warn(`fastSync: priming ${collection} failed:`, error.message)
  );
};

const revalidate = async (collection, fetchFromFirestore) => {
  if (inFlight.has(collection)) return inFlight.get(collection);

  const task = (async () => {
    try {
      const fresh = await fetchFromFirestore();
      if (Array.isArray(fresh)) {
        setMemory(collection, fresh);
        primeRtdb(collection, fresh);
        return fresh;
      }
      return getMemory(collection) || [];
    } catch (error) {
      console.warn(`fastSync: revalidate ${collection} failed:`, error.message);
      return getMemory(collection) || [];
    } finally {
      inFlight.delete(collection);
    }
  })();

  inFlight.set(collection, task);
  return task;
};

/**
 * Read a whole collection as fast as possible.
 * Returns cached data the moment it exists and refreshes in the background.
 */
export const readCollection = async (collection, fetchFromFirestore) => {
  ensureSubscription(collection);

  // tier 1
  const cached = getMemory(collection);
  if (cached && cached.length) {
    memory.set(collection, cached);
    revalidate(collection, fetchFromFirestore); // background, not awaited
    return cached;
  }

  // tier 2
  if (canUseRtdb()) {
    try {
      const snapshot = await get(ref(rtdb, `${CACHE_ROOT}/${collection}`));
      const records = toArray(snapshot.val());
      if (records.length) {
        setMemory(collection, records);
        revalidate(collection, fetchFromFirestore);
        return records;
      }
    } catch (error) {
      console.warn(`fastSync: RTDB read of ${collection} failed:`, error.message);
    }
  }

  // tier 3
  return revalidate(collection, fetchFromFirestore);
};

/* --------------------------------- write ---------------------------------- */

const patchMemory = (collection, id, record) => {
  const current = memory.get(collection) || getMemory(collection) || [];
  const index = current.findIndex((item) => item.id === id);
  const next = index >= 0 ? [...current] : [{ ...record, id }, ...current];
  if (index >= 0) next[index] = { ...next[index], ...record, id };
  setMemory(collection, next);
};

const dropFromMemory = (collection, id) => {
  const current = memory.get(collection) || getMemory(collection) || [];
  setMemory(collection, current.filter((item) => item.id !== id));
};

/**
 * Write-ahead write. Resolves as soon as the record is durable in RTDB
 * (typically well under 300 ms); the Firestore promotion continues in the
 * background and is retried from the outbox if it fails.
 *
 * @param {string}   collection
 * @param {string}   id
 * @param {object}   record        full record (without id) for the cache
 * @param {Function} firestoreWrite  async () => any — the authoritative write
 * @param {object}   [options]     { op: 'set'|'update'|'delete', awaitFirestore: boolean }
 */
export const writeRecord = async (collection, id, record, firestoreWrite, options = {}) => {
  const { op = 'set', awaitFirestore = false } = options;
  const startedAt = Date.now();
  const payload = serialize(record);

  // tier 1 — instant
  if (op === 'delete') dropFromMemory(collection, id);
  else patchMemory(collection, id, record);

  // tier 2 — fast + shared
  const rtdbWrite = canUseRtdb()
    ? Promise.all([
        op === 'delete'
          ? remove(ref(rtdb, `${CACHE_ROOT}/${collection}/${id}`))
          : set(ref(rtdb, `${CACHE_ROOT}/${collection}/${id}`), payload),
        set(ref(rtdb, `${OUTBOX_ROOT}/${collection}/${id}`), {
          op,
          data: op === 'delete' ? null : payload,
          queuedAt: Date.now()
        })
      ]).catch((error) => {
        console.warn(`fastSync: RTDB write ${collection}/${id} failed:`, error.message);
      })
    : Promise.resolve();

  // tier 3 — authoritative, then clear the outbox entry
  const promotion = Promise.resolve()
    .then(firestoreWrite)
    .then(async (result) => {
      if (canUseRtdb()) {
        await remove(ref(rtdb, `${OUTBOX_ROOT}/${collection}/${id}`)).catch(() => {});
      }
      return result;
    })
    .catch((error) => {
      console.warn(
        `fastSync: Firestore promotion of ${collection}/${id} failed, left in outbox:`,
        error.message
      );
      throw error;
    });

  if (awaitFirestore) {
    const result = await promotion;
    return { id, result, ms: Date.now() - startedAt };
  }

  // Don't let an unhandled rejection escape when we're not awaiting.
  promotion.catch(() => {});
  await rtdbWrite;
  return { id, ms: Date.now() - startedAt };
};

export const removeRecord = (collection, id, firestoreDelete) =>
  writeRecord(collection, id, null, firestoreDelete, { op: 'delete' });

/* -------------------------------- outbox ---------------------------------- */

/**
 * Retry Firestore writes that were queued in RTDB but never promoted
 * (app closed mid-write, offline, Firestore error).
 */
export const flushOutbox = async (promoters = {}) => {
  if (!canUseRtdb()) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  try {
    const snapshot = await get(ref(rtdb, OUTBOX_ROOT));
    const collections = snapshot.val() || {};

    await Promise.all(
      Object.entries(collections).map(async ([collection, entries]) => {
        const promote = promoters[collection];
        if (!promote || !entries) return;

        await Promise.all(
          Object.entries(entries).map(async ([id, entry]) => {
            try {
              await promote(id, entry);
              await remove(ref(rtdb, `${OUTBOX_ROOT}/${collection}/${id}`));
              flushed += 1;
            } catch (error) {
              failed += 1;
              console.warn(`fastSync: outbox retry ${collection}/${id} failed:`, error.message);
            }
          })
        );
      })
    );
  } catch (error) {
    console.warn('fastSync: outbox flush failed:', error.message);
  }

  return { flushed, failed };
};

/** Merge a partial patch into the cache without any Firestore work. */
export const patchCache = (collection, id, partial) => {
  patchMemory(collection, id, partial);
  if (canUseRtdb()) {
    update(ref(rtdb, `${CACHE_ROOT}/${collection}/${id}`), serialize(partial)).catch(() => {});
  }
};

export const fastSync = {
  readCollection,
  writeRecord,
  removeRecord,
  subscribeCollection,
  patchCache,
  flushOutbox,
  getMemory,
  serialize,
  stopAll
};

export default fastSync;
