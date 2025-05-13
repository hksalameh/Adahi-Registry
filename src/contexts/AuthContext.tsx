
"use client";

import type { User as AppUser, AdahiSubmission } from "@/lib/types";
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
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
  // where, // Removed for user-specific queries
  onSnapshot,
  // Timestamp, // Not directly used here
  orderBy,
  serverTimestamp,
  // writeBatch, // Not used
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AppUser | null>;
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>;
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate'>>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[];
  fetchUserById: (userId: string) => Promise<AppUser | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<AdahiSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<AdahiSubmission[]>([]);
  const { toast } = useToast();

  const router = useRouter();
  const pathname = usePathname();

  const fetchUserById = async (userId: string): Promise<AppUser | null> => {
    if (!db) {
      console.error("AuthContext: Firestore DB is not initialized.");
      return null;
    }
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        return { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
      } else {
        console.log("No such user document!");
        return null;
      }
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return null;
    }
  };


  useEffect(() => {
    if (!auth) {
      console.error("AuthContext: Firebase Auth is not initialized.");
      setLoading(false);
      setUser(null);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const appUser = await fetchUserById(firebaseUser.uid);
        if (appUser) {
            setUser(appUser);
        } else {
            // This case might happen if user exists in Auth but not in Firestore 'users' collection
            // Or if fetchUserById failed. Handle as appropriate.
            console.warn(`User with UID ${firebaseUser.uid} authenticated but no Firestore record found or fetch failed.`);
            setUser({ // Create a minimal user object or handle logout
                id: firebaseUser.uid,
                email: firebaseUser.email || "",
                username: firebaseUser.displayName || firebaseUser.email || "User",
                isAdmin: false, // Default to false if no Firestore record
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || !db) return;

    let q;
    if (user && user.isAdmin) {
      q = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
    } else if (user) {
      q = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
    } else {
      // No user logged in, or public view, fetch no submissions or all depending on requirements
      // For now, let's fetch all if no user (or adjust based on desired public behavior)
      // This matches the removed login requirement behavior
      q = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
    }
    
    const unsubscribeSubmissions = onSnapshot(q, (querySnapshot) => {
      const subs = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let submissionDateStr: string;

        if (data.submissionDate && typeof data.submissionDate.toDate === 'function') {
          // Firestore Timestamp
          submissionDateStr = data.submissionDate.toDate().toISOString();
        } else if (typeof data.submissionDate === 'string') {
          // Already a string (hopefully ISO)
          submissionDateStr = data.submissionDate;
        } else if (data.submissionDate instanceof Date) {
          // JavaScript Date object
          submissionDateStr = data.submissionDate.toISOString();
        } else {
          // Fallback for missing, null, undefined, or unexpected types
          console.warn(`Submission ${docSnapshot.id} has invalid or missing submissionDate:`, data.submissionDate, ". Using epoch as fallback.");
          submissionDateStr = new Date(0).toISOString(); // Default to Epoch or a noticeable invalid date
        }
        
        return { 
          id: docSnapshot.id, 
          ...data, 
          submissionDate: submissionDateStr 
        } as AdahiSubmission;
      });

      if (user && user.isAdmin) {
        setAllSubmissions(subs);
        setSubmissions([]); // Admin doesn't have "their" submissions in this view typically
      } else {
        setSubmissions(subs);
        // If all users should see all submissions on their dashboard, uncomment next line
        // setAllSubmissions(subs); 
      }
    }, (error) => {
      console.error("Error fetching submissions:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب البيانات." });
    });

    return () => unsubscribeSubmissions();
  }, [user, loading, toast, db]);


  const login = async (email: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
        toast({variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز."});
        return null;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      // onAuthStateChanged will fetch user doc and set user state
      // But to return the user immediately:
      const appUser = await fetchUserById(firebaseUser.uid);
      setLoading(false);
      if (appUser) {
        toast({title: "تم تسجيل الدخول بنجاح"});
        return appUser;
      }
      // Fallback if user doc not found immediately, onAuthStateChanged should still set it
      toast({title: "تم تسجيل الدخول, جاري جلب بيانات المستخدم..."});
      return {id: firebaseUser.uid, email: firebaseUser.email || "", username: firebaseUser.displayName || firebaseUser.email || "", isAdmin: false };

    } catch (error: any) {
      console.error("Login error:", error);
      setUser(null);
      setLoading(false);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage += "البيانات المدخلة غير صحيحة.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += "حدث خطأ ما.";
      }
      toast({variant: "destructive", title: "خطأ في تسجيل الدخول", description: errorMessage});
      return null;
    }
  };

  const register = async (username: string, email: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
        toast({variant: "destructive", title: "خطأ في التهيئة", description: "نظام التسجيل غير جاهز."});
        return null;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const newUser: AppUser = {
        id: firebaseUser.uid,
        username,
        email: firebaseUser.email || email, // Ensure email is set
        isAdmin: false, 
      };
      await setDoc(doc(db, "users", firebaseUser.uid), {
        username,
        email: firebaseUser.email || email,
        isAdmin: false,
      });
      setLoading(false);
      toast({title: "تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول."});
      return newUser;
    } catch (error: any) {
      console.error("Registration error:", error);
      setUser(null);
      setLoading(false);
      let errorMessage = "فشل التسجيل. ";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage += "البريد الإلكتروني مستخدم مسبقاً.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage += "كلمة المرور ضعيفة جداً.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage += "البريد الإلكتروني غير صالح.";
      } else {
        errorMessage += "حدث خطأ ما.";
      }
      toast({variant: "destructive", title: "خطأ في التسجيل", description: errorMessage});
      return null;
    }
  };

  const logout = async () => {
    if (!auth) {
        console.error("AuthContext: Firebase Auth is not initialized, cannot logout.");
        return;
    }
    try {
        await signOut(auth);
        setUser(null);
        setSubmissions([]);
        setAllSubmissions([]);
        toast({title: "تم تسجيل الخروج بنجاح"});
        if (pathname !== '/' && !pathname.startsWith('/auth')) {
          router.push("/auth/login");
        }
    } catch (error) {
        console.error("Logout error:", error);
        toast({variant: "destructive", title: "خطأ", description: "فشل تسجيل الخروج."});
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">): Promise<AdahiSubmission | null> => {
    if (!db) {
      console.error("AuthContext: Cannot add submission, DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن إضافة البيانات. النظام غير مهيأ بشكل صحيح." });
      return null;
    }
    if (!user) {
        toast({ variant: "destructive", title: "غير مصرح به", description: "يجب تسجيل الدخول لإضافة أضحية."});
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
      
      const clientSideRepresentation: AdahiSubmission = {
        ...submissionData,
        id: docRef.id,
        userId: user.id,
        userEmail: user.email,
        status: "pending",
        submissionDate: new Date().toISOString() // Represent as ISO string for consistency
      };
      return clientSideRepresentation;
    } catch (error) {
      console.error("Error adding submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في إضافة البيانات." });
      return null;
    }
  };
  
  const updateSubmissionStatus = async (submissionId: string, status: 'pending' | 'entered'): Promise<boolean> => {
    if (!db) {
      console.error("AuthContext: Cannot update status, DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث الحالة. النظام غير مهيأ." });
      return false;
    }
    if (!user || !user.isAdmin) {
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لتحديث الحالة."});
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

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate'>>): Promise<AdahiSubmission | null> => {
    if (!db) {
      console.error("AuthContext: Cannot update submission, DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث البيانات. النظام غير مهيأ." });
      return null;
    } 
    if (!user || !user.isAdmin) {
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لتحديث البيانات."});
        return null;
    }
    
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      const updateData = { ...data };
      await updateDoc(submissionDocRef, updateData);
      
      const updatedDocSnap = await getDoc(submissionDocRef);
      if (updatedDocSnap && updatedDocSnap.exists()) {
        const updatedData = updatedDocSnap.data();
        let submissionDateStr = updatedData.submissionDate;
        if (updatedData.submissionDate && typeof updatedData.submissionDate.toDate === 'function') {
          submissionDateStr = updatedData.submissionDate.toDate().toISOString();
        }
        return { id: updatedDocSnap.id, ...updatedData, submissionDate: submissionDateStr } as AdahiSubmission;
      }
      return null; // Should not happen if update was successful and doc existed
    } catch (error) {
      console.error("Error updating submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في تحديث البيانات." });
      return null;
    }
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    if (!db) {
       console.error("AuthContext: Cannot delete submission, DB not initialized.");
       toast({ variant: "destructive", title: "خطأ", description: "لا يمكن حذف البيانات. النظام غير مهيأ." });
      return false;
    } 
    if (!user || !user.isAdmin) {
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لحذف البيانات."});
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, submissions, addSubmission, updateSubmissionStatus, updateSubmission, deleteSubmission, allSubmissionsForAdmin: allSubmissions, fetchUserById }}>
      {children}
    </AuthContext.Provider>
  );
};
