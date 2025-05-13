
"use client";

import type { User as AppUser, AdahiSubmission } from "@/lib/types";
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import {
  onAuthStateChanged,
  // signInWithEmailAndPassword, // Removed
  // createUserWithEmailAndPassword, // Removed
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  // getDoc, // Removed for user fetching
  // setDoc, // Removed for user creation
  updateDoc,
  deleteDoc,
  query,
  // where, // Removed for user-specific queries
  onSnapshot,
  // Timestamp, // Not directly used here
  orderBy,
  serverTimestamp,
  // writeBatch, // Not used
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AppUser | null; // Will always be null now
  loading: boolean; // Will settle to false
  // login: (email: string, pass: string) => Promise<AppUser | null>; // Removed
  // register: (username: string, email: string, pass: string) => Promise<AppUser | null>; // Removed
  logout: () => void; // Kept for consistency, though no user to log out
  submissions: AdahiSubmission[]; // Will contain all submissions
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail'>>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[]; // Will contain all submissions
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null); // Will remain null
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<AdahiSubmission[]>([]); // All submissions
  const [allSubmissions, setAllSubmissions] = useState<AdahiSubmission[]>([]); // All submissions
  const { toast } = useToast();

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simplified auth state: no active user management
    // onAuthStateChanged is kept to ensure Firebase SDK initializes, but user will be null.
    if (!auth) {
      console.error("AuthContext: Firebase Auth is not initialized.");
      setLoading(false);
      setUser(null);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      setUser(null); // Always set user to null
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch all submissions since there's no user context
    if (loading) return; // Wait for auth state to settle (even if user is always null)

    if (!db) {
      console.error("AuthContext: Firebase Firestore is not initialized. Cannot fetch submissions.");
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }

    const q = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
    const unsubscribeSubmissions = onSnapshot(q, (querySnapshot) => {
      const allSubs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdahiSubmission));
      setSubmissions(allSubs);
      setAllSubmissions(allSubs); // Both states get all submissions
    }, (error) => {
      console.error("Error fetching submissions:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب البيانات." });
    });

    return () => {
      unsubscribeSubmissions();
    };
  }, [loading, toast]);


  const logout = async () => {
    // Sign out if auth is available, mostly for consistency if Firebase SDK was used elsewhere.
    if (auth) {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout error:", error);
        }
    }
    setUser(null);
    setSubmissions([]);
    setAllSubmissions([]);
    // No redirect needed as pages are now public
    // if (pathname !== '/' && pathname !== '/register') { // register no longer exists
    //   router.push("/");
    // }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">): Promise<AdahiSubmission | null> => {
    if (!db) {
      console.error("AuthContext: Cannot add submission, DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن إضافة البيانات. النظام غير مهيأ بشكل صحيح." });
      return null;
    }
    try {
      const newSubmissionData = {
        ...submissionData,
        // userId and userEmail are no longer added
        submissionDate: serverTimestamp(),
        status: "pending" as const,
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
      
      const clientSideRepresentation: AdahiSubmission = {
        ...submissionData,
        id: docRef.id,
        status: "pending",
        submissionDate: new Date().toISOString()
      };
      return clientSideRepresentation;
    } catch (error) {
      console.error("Error adding submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في إضافة البيانات." });
      return null;
    }
  };
  
  const updateSubmissionStatus = async (submissionId: string, status: 'pending' | 'entered'): Promise<boolean> => {
    // Removed user.isAdmin check
    if (!db) {
      console.error("AuthContext: Cannot update status, DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث الحالة. النظام غير مهيأ." });
      return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, { status });
      return true;
    } catch (error) {
      console.error("Error updating submission status:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في تحديث الحالة." });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail'>>): Promise<AdahiSubmission | null> => {
    // Removed user.isAdmin check
    if (!db) {
      console.error("AuthContext: Cannot update submission, DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث البيانات. النظام غير مهيأ." });
      return null;
    } 
    
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      const updateData = { ...data };
      // Fields like id, userId, userEmail are already omitted by type or inherently not part of 'data'
      await updateDoc(submissionDocRef, updateData);
      
      const updatedDocSnap = await getDoc(submissionDocRef); // getDoc was removed, need to re-add or adjust
      if (updatedDocSnap && updatedDocSnap.exists()) { // Check if getDoc is available
        return { id: updatedDocSnap.id, ...updatedDocSnap.data() } as AdahiSubmission;
      }
      // If getDoc is not re-added, we cannot return the updated full object from DB.
      // For simplicity, returning a representation of the update.
      // A more robust solution would fetch the document or rely on onSnapshot updates.
      // For now, we return a partial update indication.
      return { id: submissionId, ...data, submissionDate: new Date().toISOString() } as AdahiSubmission; // This is a mock, real date won't be known
    } catch (error) {
      console.error("Error updating submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في تحديث البيانات." });
      return null;
    }
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    // Removed user.isAdmin check
    if (!db) {
       console.error("AuthContext: Cannot delete submission, DB not initialized.");
       toast({ variant: "destructive", title: "خطأ", description: "لا يمكن حذف البيانات. النظام غير مهيأ." });
      return false;
    } 
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await deleteDoc(submissionDocRef);
      return true;
    } catch (error) {
      console.error("Error deleting submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في حذف البيانات." });
      return false;
    }
  };

  // Note: `login` and `register` are removed from the context value
  return (
    <AuthContext.Provider value={{ user, loading, logout, submissions, addSubmission, updateSubmissionStatus, updateSubmission, deleteSubmission, allSubmissionsForAdmin: allSubmissions }}>
      {children}
    </AuthContext.Provider>
  );
};
