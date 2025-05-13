
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfigValues = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Check if all required Firebase config values are present
const requiredConfigKeys: (keyof typeof firebaseConfigValues)[] = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

let firebaseConfig: FirebaseOptions | null = null;
let configError = false;

for (const key of requiredConfigKeys) {
  if (!firebaseConfigValues[key]) {
    console.error(`Firebase config error: Missing environment variable NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
    configError = true;
  }
}

if (!configError) {
  firebaseConfig = firebaseConfigValues as FirebaseOptions;
} else {
  console.error("Firebase initialization failed due to missing configuration. Please check your .env.local file and ensure all NEXT_PUBLIC_FIREBASE_ variables are set.");
}

// Initialize Firebase
let app;
// Ensure firebaseConfig is not null before initializing
if (!getApps().length && firebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // Potentially set app to null or handle error appropriately
  }
} else if (firebaseConfig) {
  app = getApp();
} else {
  // App cannot be initialized
  console.error("Firebase app could not be initialized because firebaseConfig is null.");
}

// Export firebase services
// It's safer to export them conditionally or handle cases where 'app' might be undefined
export const auth = app ? getAuth(app) : null; // Return null if app couldn't be initialized
export const db = app ? getFirestore(app) : null; // Return null if app couldn't be initialized

export default app; // app could be undefined here
