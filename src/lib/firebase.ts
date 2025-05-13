// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfigValues = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// قائمة بمفاتيح الإعدادات المطلوبة لـ Firebase
// تأكد من أن هذه المفاتيح تطابق تمامًا المفاتيح في firebaseConfigValues
const requiredConfigKeys: (keyof typeof firebaseConfigValues)[] = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId", // appId مهم أيضًا
];

let internalFirebaseConfig: FirebaseOptions | null = null;
let configError = false;
const missingKeys: string[] = [];

for (const key of requiredConfigKeys) {
  if (!firebaseConfigValues[key] || typeof firebaseConfigValues[key] !== 'string') {
    const envVarName = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    console.error(`Firebase config error: Missing or invalid environment variable ${envVarName} (config key: ${key})`);
    missingKeys.push(envVarName);
    configError = true;
  }
}

if (!configError) {
  const tempConfig: {[key: string]: string | undefined} = {};
  requiredConfigKeys.forEach(key => {
    tempConfig[key] = firebaseConfigValues[key];
  });
  // إضافة المفاتيح الاختيارية إذا كانت موجودة وصحيحة
  if (firebaseConfigValues.storageBucket && typeof firebaseConfigValues.storageBucket === 'string') {
    tempConfig.storageBucket = firebaseConfigValues.storageBucket;
  }
  if (firebaseConfigValues.messagingSenderId && typeof firebaseConfigValues.messagingSenderId === 'string') {
    tempConfig.messagingSenderId = firebaseConfigValues.messagingSenderId;
  }
  if (firebaseConfigValues.measurementId && typeof firebaseConfigValues.measurementId === 'string') {
    tempConfig.measurementId = firebaseConfigValues.measurementId;
  }
  internalFirebaseConfig = tempConfig as FirebaseOptions;
}

if (configError) {
  const errorMessage = `Firebase تهيئة فشلت بسبب نقص في الإعدادات: ${missingKeys.join(', ')}. يرجى التحقق من ملف .env.local والتأكد من تعيين جميع متغيرات NEXT_PUBLIC_FIREBASE_ بشكل صحيح، ثم أعد تشغيل خادم التطوير.`;
  console.error(errorMessage);
   // يمكنك اختيار عرض تنبيه للمستخدم في وضع العميل إذا لزم الأمر
   // if (typeof window !== 'undefined') {
   //   alert(errorMessage);
   // }
}

// تهيئة Firebase
let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (!configError && internalFirebaseConfig) {
  if (!getApps().length) {
    try {
      appInstance = initializeApp(internalFirebaseConfig);
    } catch (error) {
      console.error("Firebase initialization error during initializeApp:", error);
      configError = true; // Mark configError as true to prevent further Firebase service initializations
    }
  } else {
    appInstance = getApp();
  }

  if (appInstance && !configError) { // Only try to get auth/db if appInstance is valid and no previous config error
      try {
        authInstance = getAuth(appInstance);
        dbInstance = getFirestore(appInstance);
      } catch (serviceError) {
          console.error("Error getting Firebase services (auth, firestore):", serviceError);
      }
  }
} else {
  console.error("Firebase app could not be initialized due to configuration errors or null config.");
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;