// Firebase bootstrap.
// Config comes from .env.local (REACT_APP_FIREBASE_*) — nothing is hardcoded.
// Firestore = system of record. Realtime Database = low-latency cache + sync channel.
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

export let isFirebaseAvailable = false;
export let isRealtimeAvailable = false;

let app = null;
let db = null;
let rtdb = null;

const missing = ['apiKey', 'projectId', 'appId'].filter((key) => !firebaseConfig[key]);

if (missing.length) {
  console.error(
    `Firebase config incomplete (missing ${missing.join(', ')}). ` +
      'Create .env.local from .env.example and restart the dev server. Falling back to local storage.'
  );
} else {
  try {
    app = initializeApp(firebaseConfig);

    // Persistent multi-tab cache: reads and writes hit the local IndexedDB copy
    // first, so the UI updates immediately and works offline.
    //
    // This throws whenever IndexedDB is unavailable — Safari private browsing,
    // blocked storage, some embedded webviews. Falling back to the in-memory
    // Firestore instance matters: without it `db` stayed null, reads quietly
    // dropped to localStorage, and every write died on
    // "Expected first argument to collection() to be a CollectionReference".
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
    } catch (cacheError) {
      console.warn(
        'Firestore persistent cache unavailable, continuing without it:',
        cacheError?.message || cacheError
      );
      db = getFirestore(app);
    }

    isFirebaseAvailable = Boolean(db);

    if (firebaseConfig.databaseURL) {
      try {
        rtdb = getDatabase(app);
        isRealtimeAvailable = true;
      } catch (rtdbError) {
        console.warn('Realtime Database unavailable, using Firestore only:', rtdbError.message);
      }
    }
  } catch (error) {
    console.error('Firebase initialization failed, falling back to local storage:', error);
    db = null;
    isFirebaseAvailable = false;
  }
}

// Analytics is optional and must never delay first paint.
if (app && firebaseConfig.measurementId && process.env.NODE_ENV === 'production') {
  import('firebase/analytics')
    .then(({ getAnalytics, isSupported }) =>
      isSupported().then((ok) => {
        if (ok) getAnalytics(app);
      })
    )
    .catch(() => {});
}

// auth/storage stay unused for now; exported as null so old imports keep working.
export const auth = null;
export const storage = null;

export { db, rtdb };
export default app;
