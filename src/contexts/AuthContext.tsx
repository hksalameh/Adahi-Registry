
"use client";

import type { User as AppUser, AdahiSubmission } from "@/lib/types"; // Renamed to AppUser to avoid conflict
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth"; // Firebase User type
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AppUser | null>; // Changed return type
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>; // Changed return type
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<AdahiSubmission>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[];
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<AdahiSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<AdahiSubmission[]>([]);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser && auth && db) { // Ensure auth and db are not null
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const appUserData = userDocSnap.data() as Omit<AppUser, "id">;
            setUser({ id: firebaseUser.uid, ...appUserData });
          } else {
            console.warn("User document not found in Firestore for UID:", firebaseUser.uid, ". User might be authenticated but has no app data. Signing out.");
            // If user is authenticated but doc doesn't exist, sign out to prevent inconsistent state
            await signOut(auth);
            setUser(null);
          }
        } catch (error) {
            console.error("Error fetching user document in onAuthStateChanged:", error);
            // If fetching user data fails (e.g., offline, permissions), sign out.
            if (auth) { // Check auth again before signing out
                 await signOut(auth);
            }
            setUser(null);
        }
      } else {
        setUser(null);
        if (!auth || !db) {
            console.warn("onAuthStateChanged: Firebase auth or db not initialized. This often means environment variables are missing or incorrect.");
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let unsubscribeUserSubmissions: () => void = () => {};
    let unsubscribeAdminSubmissions: () => void = () => {};

    if (user && !loading) {
      if (user.isAdmin) {
        const q = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
        unsubscribeAdminSubmissions = onSnapshot(q, (querySnapshot) => {
          const adminSubs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdahiSubmission));
          setAllSubmissions(adminSubs);
          setSubmissions(adminSubs.filter(s => s.userId === user.id)); 
        }, (error) => {
          console.error("Error fetching admin submissions:", error);
        });
      } else {
        const q = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
        unsubscribeUserSubmissions = onSnapshot(q, (querySnapshot) => {
          const userSubs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdahiSubmission));
          setSubmissions(userSubs);
        }, (error) => {
          console.error("Error fetching user submissions:", error);
        });
      }
    } else if (!user && !loading) {
        setSubmissions([]);
        setAllSubmissions([]);
    }

    return () => {
      unsubscribeUserSubmissions();
      unsubscribeAdminSubmissions();
    };
  }, [user, loading]);


  const login = async (email: string, pass: string): Promise<AppUser | null> => {
    setLoading(true);
    if (!auth || !db) {
        console.error("Firebase auth or db not initialized. Cannot login.");
        setLoading(false);
        return null;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const appUserData = userDocSnap.data() as Omit<AppUser, "id">;
          const loggedInUser: AppUser = { id: firebaseUser.uid, ...appUserData };
          setUser(loggedInUser); 
          setLoading(false);
          return loggedInUser;
        } else {
          console.error("User document not found for UID after login:", firebaseUser.uid, ". Signing out.");
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return null;
        }
      }
      setUser(null); 
      setLoading(false);
      return null;
    } catch (error) {
      console.error("Login error (e.g. wrong credentials, user not found):", error);
      setUser(null);
      setLoading(false);
      return null;
    }
  };

  const register = async (username: string, email: string, pass: string): Promise<AppUser | null> => {
    setLoading(true);
    if (!auth || !db) {
        console.error("Firebase auth or db not initialized. Cannot register.");
        setLoading(false);
        return null;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      const newUser: AppUser = {
        id: firebaseUser.uid,
        username,
        email,
        isAdmin: false, 
      };
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await setDoc(userDocRef, { 
        username: newUser.username,
        email: newUser.email,
        isAdmin: newUser.isAdmin,
      });
      setUser(newUser); 
      setLoading(false);
      return newUser;
    } catch (error) {
      console.error("Registration error:", error);
      setUser(null);
      setLoading(false);
      return null;
    }
  };

  const logout = async () => {
    if (!auth) {
        console.error("Firebase auth not initialized for logout");
        return;
    }
    try {
      await signOut(auth);
      setUser(null);
      setSubmissions([]);
      setAllSubmissions([]);
      if (pathname !== '/' && pathname !== '/register') {
        router.push("/");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">): Promise<AdahiSubmission | null> => {
    if (!user || !db) {
      console.error("Cannot add submission, user not logged in or DB not initialized.");
      return null;
    }
    try {
      const newSubmissionData = {
        ...submissionData,
        userId: user.id,
        userEmail: user.email, 
        submissionDate: serverTimestamp(), 
        status: "pending" as const,
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
      
      return { 
        ...submissionData, 
        id: docRef.id, 
        userId: user.id, 
        userEmail: user.email, 
        status: "pending",
        submissionDate: new Date().toISOString() // Approximate, serverTimestamp is better
      };
    } catch (error) {
      console.error("Error adding submission:", error);
      return null;
    }
  };
  
  const updateSubmissionStatus = async (submissionId: string, status: 'pending' | 'entered'): Promise<boolean> => {
    if (!user || !user.isAdmin || !db) {
      console.error("Cannot update status, permission denied or DB not initialized.");
      return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, { status });
      return true;
    } catch (error) {
      console.error("Error updating submission status:", error);
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<AdahiSubmission>): Promise<AdahiSubmission | null> => {
    if (!user || !user.isAdmin || !db) {
      console.error("Cannot update submission, permission denied or DB not initialized.");
      return null;
    } 
    
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      const updateData = { ...data };
      delete updateData.submissionDate; 
      delete updateData.id;
      delete updateData.userId;
      delete updateData.userEmail;

      await updateDoc(submissionDocRef, updateData);
      
      const updatedDocSnap = await getDoc(submissionDocRef);
      if (updatedDocSnap.exists()) {
        return { id: updatedDocSnap.id, ...updatedDocSnap.data() } as AdahiSubmission;
      }
      return null;
    } catch (error) {
      console.error("Error updating submission:", error);
      return null;
    }
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    if (!user || !user.isAdmin || !db) {
       console.error("Cannot delete submission, permission denied or DB not initialized.");
      return false;
    } 
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await deleteDoc(submissionDocRef);
      return true;
    } catch (error) {
      console.error("Error deleting submission:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, submissions, addSubmission, updateSubmissionStatus, updateSubmission, deleteSubmission, allSubmissionsForAdmin: allSubmissions }}>
      {children}
    </AuthContext.Provider>
  );
};

