// Firebase configuration with fallback
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// import { getAuth } from 'firebase/auth';  // Disabled for now
// import { getStorage } from 'firebase/storage';  // Disabled for now

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyACnCJ0C0p8Egu7PfWBq0RHHHimz-ShtsE",
  authDomain: "suhelroadlineserp.firebaseapp.com",
  projectId: "suhelroadlineserp",
  storageBucket: "suhelroadlineserp.firebasestorage.app",
  messagingSenderId: "880576594120",
  appId: "1:880576594120:web:4cb9a3b461b160d7cf65fd",
  measurementId: "G-EXGWGVHWJG"
};

// Firebase availability flag
export let isFirebaseAvailable = false;

// Initialize Firebase with error handling
let app = null;
let db = null;
let auth = null;
let storage = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  // Only initialize Firestore for now, skip Auth and Storage
  // auth = getAuth(app);
  // storage = getStorage(app);
  isFirebaseAvailable = true;
  console.log('Firebase initialized successfully (Firestore only)');
} catch (error) {
  console.error('Firebase initialization failed:', error);
  console.warn('Falling back to local storage mode');
  isFirebaseAvailable = false;
}

// Export Firebase services (auth and storage will be null)
export { db, auth, storage };
export default app;
