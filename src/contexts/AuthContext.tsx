
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

const ADMIN_UID = "vqhrldpAdeWGcCgcMpWWRGdslOS2"; 

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
        // Ensure isAdmin is correctly derived
        const isAdmin = userId === ADMIN_UID || userData.isAdmin === true;
        return { id: userDocSnap.id, ...userData, email: userData.email || "", username: userData.username || "", isAdmin } as AppUser;
      } else {
        if (userId === ADMIN_UID) { // Handle case where admin user doc might not exist but UID matches
            return {
                id: userId,
                email: "admin@example.com", // Placeholder, will be overridden by auth state if available
                username: "Admin",
                isAdmin: true,
            };
        }
        console.log(`No user document for ID: ${userId}, and UID is not ADMIN_UID.`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return null;
    }
  };


  useEffect(() => {
    if (!auth) {
      console.warn("Auth service not available for onAuthStateChanged.");
      setLoading(false);
      setUser(null);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const appUser = await fetchUserById(firebaseUser.uid);
        if (appUser) {
            setUser({...appUser, email: firebaseUser.email || appUser.email}); // Ensure email from auth is prioritized
        } else {
            // Fallback if fetchUserById returns null but firebaseUser exists (e.g., new user not yet in DB or admin case)
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
  }, []); // Removed db from dependencies as fetchUserById checks it

  useEffect(() => {
    if (!db || !user) { 
        setSubmissions([]);
        if (!user || !user.isAdmin) {
            setAllSubmissions([]);
        }
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
           // Fallback for unexpected date format, or if date is missing
          submissionDateStr = new Date().toISOString(); // Or handle as 'N/A' or skip item
          console.warn("Submission has invalid or missing submissionDate:", docSnapshot.id, data.submissionDate);
        }
        
        return { 
          id: docSnapshot.id, 
          ...data, 
          submissionDate: submissionDateStr 
        } as AdahiSubmission;
      });

      if (user.isAdmin) {
        setAllSubmissions(subs);
      } else {
        setSubmissions(subs);
      }
    }, (error) => {
      console.error("Error fetching submissions:", error);
      toast({ variant: "destructive", title: "خطأ في جلب البيانات", description: `فشل في جلب الأضاحي: ${error.message}` });
    });

    return () => unsubscribeSubmissions();
  }, [user, toast]); // db removed as it's checked inside, loading not needed here


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
      
      if (appUser) {
        // setUser({...appUser, email: firebaseUser.email || appUser.email }); // Handled by onAuthStateChanged
        toast({title: "تم تسجيل الدخول بنجاح"});
        setLoading(false);
        return {...appUser, email: firebaseUser.email || appUser.email};
      }
      
      const minimalUser: AppUser = {
        id: firebaseUser.uid, 
        email: firebaseUser.email || "", 
        username: firebaseUser.displayName || firebaseUser.email || "مستخدم", 
        isAdmin: firebaseUser.uid === ADMIN_UID 
      };
      // setUser(minimalUser); // Handled by onAuthStateChanged
      toast({title: "تم تسجيل الدخول, جاري جلب بيانات المستخدم..."});
      setLoading(false);
      return minimalUser;

    } catch (error: any) {
      console.error("Login error:", error);
      // setUser(null); // Handled by onAuthStateChanged if auth state changes
      setLoading(false);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage += "البيانات المدخلة غير صحيحة.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += error.message || "حدث خطأ ما.";
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
      
      const isAdmin = firebaseUser.uid === ADMIN_UID; 
      const newUserFirestoreData = {
        username,
        email: firebaseUser.email || email, // Prioritize email from auth
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
      // setUser(null); // Let onAuthStateChanged handle if needed
      setLoading(false);
      let errorMessage = "فشل التسجيل. ";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage += "البريد الإلكتروني مستخدم مسبقاً.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage += "كلمة المرور ضعيفة جداً.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage += "البريد الإلكتروني غير صالح.";
      } else {
        errorMessage += error.message || "حدث خطأ ما.";
      }
      toast({variant: "destructive", title: "خطأ في التسجيل", description: errorMessage});
      return null;
    }
  };

  const logout = async () => {
    if (!auth) {
        toast({variant: "destructive", title: "خطأ", description: "نظام تسجيل الخروج غير مهيأ."});
        return;
    }
    try {
        await signOut(auth);
        // setUser(null); // Handled by onAuthStateChanged
        // setSubmissions([]);
        // setAllSubmissions([]);
        toast({title: "تم تسجيل الخروج بنجاح"});
        router.push("/auth/login"); 
    } catch (error: any) {
        console.error("Logout error:", error);
        toast({variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج."});
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">): Promise<AdahiSubmission | null> => {
    if (!db) {
      toast({ variant: "destructive", title: "خطأ", description: "قاعدة البيانات غير مهيأة." });
      return null;
    }
    if (!user) {
      toast({ variant: "destructive", title: "غير مصرح به", description: "يجب تسجيل الدخول أولاً." });
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
        userId: newSubmissionData.userId,
        userEmail: newSubmissionData.userEmail,
        status: "pending",
        submissionDate: new Date().toISOString()
      };
      return clientSideRepresentation;
    } catch (error: any) {
      console.error("Error adding submission:", error);
      let specificMessage = "فشل في إضافة البيانات.";
      if (error.code === 'permission-denied') {
        specificMessage = "فشل في إضافة البيانات: ليس لديك الصلاحيات اللازمة.";
      } else if (error.message) {
        specificMessage = `فشل في إضافة البيانات: ${error.message}`;
      }
      toast({ variant: "destructive", title: "خطأ", description: specificMessage });
      return null;
    }
  };
  
  const updateSubmissionStatus = async (submissionId: string, status: 'pending' | 'entered'): Promise<boolean> => {
    if (!db) {
      toast({ variant: "destructive", title: "خطأ", description: "قاعدة البيانات غير مهيأة." });
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
    } catch (error: any) {
      console.error("Error updating submission status:", error);
      let specificMessage = "فشل في تحديث الحالة.";
      if (error.code === 'permission-denied') {
        specificMessage = "فشل في تحديث الحالة: ليس لديك الصلاحيات اللازمة.";
      } else if (error.message) {
        specificMessage = `فشل في تحديث الحالة: ${error.message}`;
      }
      toast({ variant: "destructive", title: "خطأ في تحديث الحالة", description: specificMessage });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate'>>): Promise<AdahiSubmission | null> => {
    if (!db) {
      toast({ variant: "destructive", title: "خطأ", description: "قاعدة البيانات غير مهيأة." });
      return null;
    } 
    if (!user || !user.isAdmin) { 
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لتحديث البيانات."});
        return null;
    }
    
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      const updateData = { ...data, lastUpdated: serverTimestamp() };
      await updateDoc(submissionDocRef, updateData);
      
      const updatedDocSnap = await getDoc(submissionDocRef);
      if (updatedDocSnap && updatedDocSnap.exists()) {
        const updatedData = updatedDocSnap.data();
        let submissionDateStr = updatedData.submissionDate;
         if (updatedData.submissionDate && typeof updatedData.submissionDate.toDate === 'function') {
          submissionDateStr = updatedData.submissionDate.toDate().toISOString();
        } else if (typeof updatedData.submissionDate === 'string') {
            submissionDateStr = updatedData.submissionDate;
        } else if (updatedData.submissionDate instanceof Date) {
            submissionDateStr = updatedData.submissionDate.toISOString();
        } else {
            submissionDateStr = new Date().toISOString(); // Fallback
        }

        let lastUpdatedStr = updatedData.lastUpdated;
        if (updatedData.lastUpdated && typeof updatedData.lastUpdated.toDate === 'function') {
            lastUpdatedStr = updatedData.lastUpdated.toDate().toISOString();
        } else if (typeof updatedData.lastUpdated === 'string') {
            lastUpdatedStr = updatedData.lastUpdated;
        } else if (updatedData.lastUpdated instanceof Date) {
            lastUpdatedStr = updatedData.lastUpdated.toISOString();
        }


        return { 
            id: updatedDocSnap.id, 
            donorName: updatedData.donorName || "",
            sacrificeFor: updatedData.sacrificeFor || "",
            phoneNumber: updatedData.phoneNumber || "",
            wantsToAttend: updatedData.wantsToAttend === true,
            wantsFromSacrifice: updatedData.wantsFromSacrifice === true,
            sacrificeWishes: updatedData.sacrificeWishes || "",
            paymentConfirmed: updatedData.paymentConfirmed === true,
            receiptBookNumber: updatedData.receiptBookNumber || "",
            voucherNumber: updatedData.voucherNumber || "",
            throughIntermediary: updatedData.throughIntermediary === true,
            intermediaryName: updatedData.intermediaryName || "",
            distributionPreference: updatedData.distributionPreference || "ramtha",
            status: updatedData.status || "pending",
            userId: updatedData.userId || "",
            userEmail: updatedData.userEmail || "",
            submissionDate: submissionDateStr,
            lastUpdated: lastUpdatedStr, // Include lastUpdated if it exists
         } as AdahiSubmission;
      }
      return null; 
    } catch (error: any) {
      console.error("Error updating submission:", error);
      let specificMessage = "فشل في تحديث البيانات.";
      if (error.code === 'permission-denied') {
        specificMessage = "فشل في تحديث البيانات: ليس لديك الصلاحيات اللازمة.";
      } else if (error.message) {
        specificMessage = `فشل في تحديث البيانات: ${error.message}`;
      }
      toast({ variant: "destructive", title: "خطأ في تحديث البيانات", description: specificMessage });
      return null;
    }
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    if (!db) {
       toast({ variant: "destructive", title: "خطأ", description: "قاعدة البيانات غير مهيأة." });
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
    } catch (error: any) {
      console.error("Error deleting submission:", error);
      let specificMessage = "فشل في حذف البيانات.";
      if (error.code === 'permission-denied') {
        specificMessage = "فشل في حذف البيانات: ليس لديك الصلاحيات اللازمة.";
      } else if (error.message) {
        specificMessage = `فشل في حذف البيانات: ${error.message}`;
      }
      toast({ variant: "destructive", title: "خطأ في حذف البيانات", description: specificMessage });
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, submissions, addSubmission, updateSubmissionStatus, updateSubmission, deleteSubmission, allSubmissionsForAdmin: allSubmissions, fetchUserById }}>
      {children}
    </AuthContext.Provider>
  );
};

