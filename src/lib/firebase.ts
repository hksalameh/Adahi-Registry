import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA1flOt_nu7Z86Fx5kxsYG-ltSnM0pWqsA",
  authDomain: "adahi-project.firebaseapp.com",
  projectId: "adahi-project",
  storageBucket: "adahi-project.firebasestorage.app",
  messagingSenderId: "157383113576",
  appId: "1:157383113576:web:e1de3febcdcc284368f4dd"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
