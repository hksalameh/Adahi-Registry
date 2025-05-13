
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
  where, 
  onSnapshot,
  orderBy,
  serverTimestamp,
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

const ADMIN_UID = "vqhrldpAdeWGcCgcMpWWRGdslOS2"; // Define the admin UID

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
        const userData = userDocSnap.data();
        // Explicitly check if this user is the admin
        const isAdmin = userId === ADMIN_UID || userData.isAdmin === true;
        return { id: userDocSnap.id, ...userData, isAdmin } as AppUser;
      } else {
        // If user doc doesn't exist, but it's the admin UID, create a minimal admin user object
        if (userId === ADMIN_UID) {
            return {
                id: userId,
                email: "admin@example.com", // Placeholder, will be updated by auth
                username: "Admin",
                isAdmin: true,
            };
        }
        console.log("No such user document for non-admin user!");
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
            setUser({...appUser, email: firebaseUser.email || appUser.email}); // Ensure email from auth is preferred
        } else {
            console.warn(`User with UID ${firebaseUser.uid} authenticated but no Firestore record found or fetch failed.`);
            setUser({ 
                id: firebaseUser.uid,
                email: firebaseUser.email || "",
                username: firebaseUser.displayName || firebaseUser.email || "User",
                isAdmin: firebaseUser.uid === ADMIN_UID, 
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
    if (loading || !db || !user) { // Require user for fetching submissions
        setSubmissions([]);
        setAllSubmissions([]);
        return;
    }

    let q;
    if (user.isAdmin) {
      q = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
    } else {
      q = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
    } 
    
    const unsubscribeSubmissions = onSnapshot(q, (querySnapshot) => {
      const subs = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let submissionDateStr: string;

        if (data.submissionDate && typeof data.submissionDate.toDate === 'function') {
          submissionDateStr = data.submissionDate.toDate().toISOString();
        } else if (typeof data.submissionDate === 'string') {
          submissionDateStr = data.submissionDate;
        } else if (data.submissionDate instanceof Date) {
          submissionDateStr = data.submissionDate.toISOString();
        } else {
          console.warn(`Submission ${docSnapshot.id} has invalid or missing submissionDate:`, data.submissionDate, ". Using epoch as fallback.");
          submissionDateStr = new Date(0).toISOString(); 
        }
        
        return { 
          id: docSnapshot.id, 
          ...data, 
          submissionDate: submissionDateStr 
        } as AdahiSubmission;
      });

      if (user.isAdmin) {
        setAllSubmissions(subs);
        setSubmissions([]); 
      } else {
        setSubmissions(subs);
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
      const appUser = await fetchUserById(firebaseUser.uid);
      setLoading(false);
      if (appUser) {
        toast({title: "تم تسجيل الدخول بنجاح"});
        setUser({...appUser, email: firebaseUser.email || appUser.email}); // Update state immediately
        return {...appUser, email: firebaseUser.email || appUser.email};
      }
      // Fallback if user doc not found immediately
      const minimalUser = {
        id: firebaseUser.uid, 
        email: firebaseUser.email || "", 
        username: firebaseUser.displayName || firebaseUser.email || "", 
        isAdmin: firebaseUser.uid === ADMIN_UID 
      };
      setUser(minimalUser);
      toast({title: "تم تسجيل الدخول, جاري جلب بيانات المستخدم..."});
      return minimalUser;

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
      
      const isAdmin = firebaseUser.uid === ADMIN_UID; // Check if registering user is the admin
      const newUserFirestoreData = {
        username,
        email: firebaseUser.email || email,
        isAdmin: isAdmin, 
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);
      
      const appUser: AppUser = {
        id: firebaseUser.uid,
        ...newUserFirestoreData
      };

      setLoading(false);
      toast({title: "تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول."});
      return appUser;
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
        router.push("/auth/login");
        
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
        router.push(`/auth/login?redirect=${pathname}`);
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
      return null; 
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
