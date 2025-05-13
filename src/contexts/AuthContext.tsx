"use client";

import type { User as AppUser, AdahiSubmission } from "@/lib/types"; // Renamed to AppUser to avoid conflict
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase"; // Correctly import potentially null auth and db
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
import { useToast } from "@/hooks/use-toast"; // Import useToast


interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AppUser | null>;
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>;
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
  const { toast } = useToast(); // Initialize toast

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!auth) {
      console.error("AuthContext: Firebase Auth is not initialized. Cannot set up onAuthStateChanged listener. Check Firebase configuration in .env.local and restart the server.");
      setLoading(false);
      setUser(null);
      // Consider showing a toast for critical Firebase setup error.
      // toast({ variant: "destructive", title: "خطأ فادح في النظام", description: "فشل تهيئة خدمة المصادقة. يرجى الاتصال بالدعم." });
      return; 
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) { 
        if (!db) {
          console.error("AuthContext: Firebase Firestore is not initialized. Cannot fetch user document.");
          setUser(null); // Or handle as partially logged in without full app data
          setLoading(false);
          return;
        }
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const appUserData = userDocSnap.data() as Omit<AppUser, "id">;
            setUser({ id: firebaseUser.uid, ...appUserData });
          } else {
            console.warn("User document not found in Firestore for UID:", firebaseUser.uid);
            await signOut(auth); // Sign out if app-specific user data is missing
            setUser(null);
          }
        } catch (error) {
            console.error("Error fetching user document in onAuthStateChanged:", error);
            if (auth) await signOut(auth);
            setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []); // auth should be stable (either initialized or null)

  useEffect(() => {
    let unsubscribeUserSubmissions: () => void = () => {};
    let unsubscribeAdminSubmissions: () => void = () => {};

    if (user && !loading) {
      if (!db) {
          console.error("AuthContext: Firebase Firestore is not initialized. Cannot fetch submissions. Check Firebase configuration.");
          // toast({ variant: "destructive", title: "خطأ في النظام", description: "فشل تهيئة قاعدة البيانات. لا يمكن جلب البيانات." });
          setSubmissions([]);
          setAllSubmissions([]);
          return;
      }

      if (user.isAdmin) {
        const q = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
        unsubscribeAdminSubmissions = onSnapshot(q, (querySnapshot) => {
          const adminSubs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdahiSubmission));
          setAllSubmissions(adminSubs);
          // Admin also sees their own submissions if they happen to make any under their ID
          setSubmissions(adminSubs.filter(s => s.userId === user.id)); 
        }, (error) => {
          console.error("Error fetching admin submissions:", error);
          toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب بيانات المدير." });
        });
      } else {
        const q = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
        unsubscribeUserSubmissions = onSnapshot(q, (querySnapshot) => {
          const userSubs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdahiSubmission));
          setSubmissions(userSubs);
        }, (error) => {
          console.error("Error fetching user submissions:", error);
          toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب بيانات المستخدم." });
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
  }, [user, loading, toast]); // db should be stable


  const login = async (email: string, pass: string): Promise<AppUser | null> => {
    setLoading(true);
    if (!auth || !db) {
        console.error("AuthContext: Firebase auth or db not initialized. Cannot login.");
        toast({ variant: "destructive", title: "خطأ في النظام", description: "فشل تهيئة Firebase. يرجى مراجعة مسؤول النظام." });
        setLoading(false);
        return null;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      // onAuthStateChanged will fetch user doc and set user state
      // But to return the user immediately:
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const appUserData = { id: firebaseUser.uid, ...userDocSnap.data() } as AppUser;
        // setUser(appUserData); // onAuthStateChanged should handle this to avoid race conditions
        setLoading(false);
        return appUserData;
      } else {
        // This case should ideally be handled by onAuthStateChanged if user doc is missing after auth.
        console.error("User document not found after login, UID:", firebaseUser.uid);
        await signOut(auth);
        setUser(null);
        setLoading(false);
        return null;
      }
    } catch (error) {
      console.error("Login error:", error);
      setUser(null);
      setLoading(false);
      return null;
    }
  };

  const register = async (username: string, email: string, pass: string): Promise<AppUser | null> => {
    setLoading(true);
    if (!auth || !db) {
        console.error("AuthContext: Firebase auth or db not initialized. Cannot register.");
        toast({ variant: "destructive", title: "خطأ في النظام", description: "فشل تهيئة Firebase. يرجى مراجعة مسؤول النظام." });
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
      // setUser(newUser); // onAuthStateChanged will handle this
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
        console.error("AuthContext: Firebase auth not initialized for logout.");
        toast({ variant: "destructive", title: "خطأ في النظام", description: "فشل تهيئة Firebase. يرجى مراجعة مسؤول النظام." });
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
      toast({ variant: "destructive", title: "خطأ", description: "فشل تسجيل الخروج." });
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">): Promise<AdahiSubmission | null> => {
    if (!user || !db) {
      console.error("AuthContext: Cannot add submission, user not logged in or DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن إضافة البيانات. تأكد من تسجيل الدخول وأن النظام مهيأ بشكل صحيح." });
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
      
      // Construct a client-side representation; actual timestamp comes from server upon read
      const clientSideRepresentation: AdahiSubmission = {
        ...submissionData,
        id: docRef.id, 
        userId: user.id, 
        userEmail: user.email, 
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
    if (!user || !user.isAdmin || !db) {
      console.error("AuthContext: Cannot update status, permission denied or DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث الحالة. الصلاحيات غير كافية أو النظام غير مهيأ." });
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

  const updateSubmission = async (submissionId: string, data: Partial<AdahiSubmission>): Promise<AdahiSubmission | null> => {
    if (!user || !user.isAdmin || !db) {
      console.error("AuthContext: Cannot update submission, permission denied or DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث البيانات. الصلاحيات غير كافية أو النظام غير مهيأ." });
      return null;
    } 
    
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      const updateData = { ...data };
      // Remove fields that should not be directly updated this way or are immutable
      delete updateData.id;
      delete updateData.userId;
      delete updateData.userEmail;
      // submissionDate should ideally not be changed by client after creation, unless specific reason
      // delete updateData.submissionDate; 

      await updateDoc(submissionDocRef, updateData);
      
      const updatedDocSnap = await getDoc(submissionDocRef);
      if (updatedDocSnap.exists()) {
        return { id: updatedDocSnap.id, ...updatedDocSnap.data() } as AdahiSubmission;
      }
      return null;
    } catch (error) {
      console.error("Error updating submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في تحديث البيانات." });
      return null;
    }
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    if (!user || !user.isAdmin || !db) {
       console.error("AuthContext: Cannot delete submission, permission denied or DB not initialized.");
       toast({ variant: "destructive", title: "خطأ", description: "لا يمكن حذف البيانات. الصلاحيات غير كافية أو النظام غير مهيأ." });
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, submissions, addSubmission, updateSubmissionStatus, updateSubmission, deleteSubmission, allSubmissionsForAdmin: allSubmissions }}>
      {children}
    </AuthContext.Provider>
  );
};