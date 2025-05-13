"use client";

import type { User as AppUser, AdahiSubmission } from "@/lib/types";
import React, { createContext, useState, useEffect, ReactNode, useCallback } from "react";
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
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  enableNetwork,
  disableNetwork, // Added disableNetwork for completeness
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AppUser | null>; // Changed identifier to email
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>;
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail'>>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[];
  fetchUserById: (userId: string) => Promise<AppUser | null>;
  fetchUserByUsername: (username: string) => Promise<AppUser | null>;
  refreshData: () => Promise<void>;
}

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || "vqhrldpAdeWGcCgcMpWWRGdslOS2";

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<AdahiSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<AdahiSubmission[]>([]);
  const { toast } = useToast();

  const router = useRouter();
  const pathname = usePathname();

  const fetchUserById = useCallback(async (userId: string): Promise<AppUser | null> => {
    if (!db) {
      console.error("AuthContext: Firestore DB is not initialized for fetchUserById.");
      return null;
    }
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        return {
          id: userDocSnap.id,
          email: userData.email || "", 
          username: userData.username || "مستخدم", 
          isAdmin: userData.isAdmin === true || userId === ADMIN_UID, // Ensure admin UID always has admin true
        } as AppUser;
      } else {
         if (userId === ADMIN_UID) {
          console.warn(`Admin user document with UID ${ADMIN_UID} not found in Firestore. Returning minimal admin profile.`);
          // Create a minimal admin profile if doc is missing
          return {
            id: ADMIN_UID,
            email: process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com", // Fallback admin email
            username: "Admin",
            isAdmin: true,
          };
        }
        return null;
      }
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return null;
    }
  }, []); 

  const fetchUserByUsername = useCallback(async (username: string): Promise<AppUser | null> => {
    if (!db) {
      console.error("AuthContext: Firestore DB is not initialized for fetchUserByUsername.");
      toast({ variant: "destructive", title: "خطأ في النظام", description: "قاعدة البيانات غير مهيأة." });
      return null;
    }
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      // Defensive check for field types
      if (typeof userData.email !== 'string' || typeof userData.username !== 'string') {
        console.error(`User document ${userDoc.id} has missing or invalid email/username fields.`);
        return null; 
      }

      return {
        id: userDoc.id,
        email: userData.email,
        username: userData.username,
        isAdmin: userData.isAdmin === true || userDoc.id === ADMIN_UID, // Ensure admin UID always has admin true
      } as AppUser;

    } catch (error) {
      console.error("Error fetching user by username:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب بيانات المستخدم." });
      return null;
    }
  }, [toast]);


  useEffect(() => {
    if (!auth || !db) {
      console.warn("Auth or DB service not available. Check Firebase configuration.");
      setLoading(false);
      setUser(null);
      return;
    }
  
    let networkEnabled = false;
    enableNetwork(db)
      .then(() => {
        networkEnabled = true;
        console.log("Firestore network enabled.");
      })
      .catch(err => console.error("Error enabling network for Firestore:", err));
  
    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        const appUser = await fetchUserById(firebaseUser.uid);
        if (appUser) {
            setUser({
                ...appUser,
                email: firebaseUser.email || appUser.email,
                isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
            });
        } else {
            // Should ideally not happen if registration is correct.
            // For admin, we already handle missing doc in fetchUserById.
            console.warn(`User with UID ${firebaseUser.uid} authenticated but no Firestore document found. Logging out.`);
            await signOut(auth); // Sign out inconsistent user
            setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  
    return () => {
      unsubscribeAuthStateChanged();
      // if (networkEnabled) {
      //   disableNetwork(db).catch(err => console.error("Error disabling network for Firestore:", err));
      // }
    };
  }, [fetchUserById]); 

  useEffect(() => {
    if (!db || !user) {
      setSubmissions([]);
      setAllSubmissions([]);
      return () => {};
    }

    let unsubscribeAdminSubmissions: (() => void) | null = null;

    if (user.isAdmin && user.id === ADMIN_UID) {
      const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
      unsubscribeAdminSubmissions = onSnapshot(adminQuery, (querySnapshot) => {
        const subs = querySnapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            ...data,
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString(): new Date().toISOString()),
          } as AdahiSubmission;
        });
        setAllSubmissions(subs);
      }, (error) => {
        console.error("Error fetching admin submissions:", error);
        if (error.message.includes("offline")) {
           toast({ variant: "destructive", title: "غير متصل", description: "لا يمكن جلب بيانات المدير لأنك غير متصل بالإنترنت." });
        } else if (error.code === 'permission-denied'){
           toast({ variant: "destructive", title: "خطأ في الصلاحيات", description: "ليس لديك الصلاحية الكافية لجلب بيانات المدير." });
        } else if (error.code === 'unimplemented' && error.message.toLowerCase().includes("datastore")) {
          console.warn("Firestore emulator data might not persist sessions well or has other issues. Trying to proceed.");
        } else {
          toast({ variant: "destructive", title: "خطأ في جلب بيانات المدير", description: `فشل في جلب الأضاحي: ${error.message}` });
        }
      });
    }
    
    const userQuery = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
    const unsubscribeUserSubmissions = onSnapshot(userQuery, (querySnapshot) => {
      const subs = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
          lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString(): new Date().toISOString()),
        } as AdahiSubmission;
      });
      setSubmissions(subs);
    }, (error) => {
      console.error("Error fetching user submissions:", error);
      if (error.code === 'failed-precondition' && error.message.includes('requires an index')) {
         toast({ variant: "destructive", title: "خطأ في قاعدة البيانات", description: "يتطلب الاستعلام فهرسًا. يرجى مراجعة Firebase Console لإنشاء الفهرس المطلوب." });
      } else if (error.message.includes("offline")) {
         toast({ variant: "destructive", title: "غير متصل", description: "لا يمكن جلب البيانات لأنك غير متصل بالإنترنت." });
      } else if (error.code === 'permission-denied'){
         toast({ variant: "destructive", title: "خطأ في الصلاحيات", description: "ليس لديك الصلاحية الكافية لجلب بياناتك." });
       } else if (error.code === 'unimplemented' && error.message.toLowerCase().includes("datastore")) {
          console.warn("Firestore emulator data might not persist sessions well or has other issues. Trying to proceed.");
        } else {
        toast({ variant: "destructive", title: "خطأ في جلب البيانات", description: `فشل في جلب الأضاحي: ${error.message}` });
      }
    });
    
    return () => {
        if (unsubscribeAdminSubmissions) unsubscribeAdminSubmissions();
        unsubscribeUserSubmissions();
    };
  }, [db, user, toast]);


  const login = async (email: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
        toast({variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز."});
        return null;
    }
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      // After successful Firebase Auth, fetch the complete user profile from Firestore
      const appUser = await fetchUserById(firebaseUser.uid);

      if (!appUser) {
        // This is an edge case: user authenticated with Firebase Auth, but no Firestore doc.
        console.error(`User ${firebaseUser.uid} authenticated but no Firestore document found.`);
        if (firebaseUser.uid === ADMIN_UID) {
          // fetchUserById already returns a minimal admin profile if doc is missing.
          // We can use that directly or enhance the warning.
           const minimalAdminUser = await fetchUserById(ADMIN_UID); // Re-fetch to ensure it's the specific minimal one
           toast({ variant: "warning", title: "تنبيه", description: "ملف تعريف المدير غير كامل في قاعدة البيانات ولكن تم تسجيل الدخول." });
           setLoading(false);
           return minimalAdminUser;
        }
        
        toast({ variant: "destructive", title: "خطأ في الحساب", description: "ملف تعريف المستخدم غير موجود في قاعدة البيانات." });
        setLoading(false);
        await signOut(auth); // Sign out the user as their profile is incomplete
        return null;
      }
      
      // Ensure isAdmin flag is correctly set for the ADMIN_UID, overriding if necessary
      if (appUser.id === ADMIN_UID && !appUser.isAdmin) {
          console.warn(`User with ADMIN_UID (${ADMIN_UID}) was fetched from Firestore but isAdmin was false. Enforcing admin status.`);
          appUser.isAdmin = true;
      }
      
      setLoading(false);
      return appUser; // Return the profile from Firestore

    } catch (error: any) {
      console.error("Login error in AuthContext:", error);
      setLoading(false);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        errorMessage += "البيانات المدخلة غير صحيحة.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += "الرجاء التحقق من البريد الإلكتروني وكلمة المرور.";
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

    const arabicUsernameRegex = /^[\u0600-\u06FF\s\u0660-\u0669a-zA-Z0-9_.-]{3,}$/;
    if (!arabicUsernameRegex.test(username)) {
        toast({variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل ويمكن أن يحتوي على حروف عربية، إنجليزية، أرقام، والرموز (- . _).", duration: 7000});
        return null;
    }

    const existingUserByUsername = await fetchUserByUsername(username);
    if (existingUserByUsername) {
        toast({variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم هذا موجود بالفعل. الرجاء اختيار اسم آخر."});
        return null;
    }
    
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      const isAdminUser = firebaseUser.uid === ADMIN_UID;
      const newUserFirestoreData = {
        username,
        email: firebaseUser.email || email, 
        isAdmin: isAdminUser,
        createdAt: serverTimestamp(), // Add creation timestamp
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);

      const appUser: AppUser = {
        id: firebaseUser.uid,
        username: newUserFirestoreData.username,
        email: newUserFirestoreData.email,
        isAdmin: newUserFirestoreData.isAdmin,
      };

      setLoading(false);
      toast({title: "تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول."});
      return appUser;
    } catch (error: any) {
      console.error("Registration error:", error);
      setLoading(false);
      let errorMessage = "فشل التسجيل. ";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage += "البريد الإلكتروني مستخدم مسبقاً.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage += "كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage += "البريد الإلكتروني غير صالح.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      }
       else {
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
        // setUser(null) will be handled by onAuthStateChanged
        router.push("/auth/login"); 
    } catch (error: any) {
        console.error("Logout error:", error);
        toast({variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج."});
    }
  };

  const refreshData = useCallback(async () => {
    if (!db || !user) {
      return;
    }
    setLoading(true);
    try {
      // Fetch admin submissions if the current user is admin
      if (user.isAdmin && user.id === ADMIN_UID) {
        const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
        const adminSnapshot = await getDocs(adminQuery);
        const adminSubs = adminSnapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          return { 
            id: docSnapshot.id, ...data, 
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : new Date(data.submissionDate).toISOString(),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : new Date(data.lastUpdated).toISOString(),
          } as AdahiSubmission;
        });
        setAllSubmissions(adminSubs);
      }

      // Fetch current user's submissions
      const userQuery = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
      const userSnapshot = await getDocs(userQuery);
      const userSubs = userSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return { 
            id: docSnapshot.id, ...data, 
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : new Date(data.submissionDate).toISOString(),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : new Date(data.lastUpdated).toISOString(),
        } as AdahiSubmission;
      });
      setSubmissions(userSubs);

    } catch (error: any) {
        console.error("Error refreshing data:", error);
        toast({variant: "destructive", title: "خطأ", description: `فشل في تحديث البيانات: ${error.message}`});
    } finally {
        setLoading(false);
    }
  }, [db, user, toast]);


  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated">): Promise<AdahiSubmission | null> => {
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
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.id, 
        lastUpdatedByEmail: user.email,
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
      // onSnapshot will update data, but we can optimistically return
      const clientSideRepresentation: AdahiSubmission = {
        ...submissionData,
        id: docRef.id,
        userId: newSubmissionData.userId,
        userEmail: newSubmissionData.userEmail,
        status: "pending",
        submissionDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: newSubmissionData.lastUpdatedBy,
        lastUpdatedByEmail: newSubmissionData.lastUpdatedByEmail,
      };
      await refreshData(); // Manually trigger refresh after adding
      return clientSideRepresentation;
    } catch (error: any) {
      console.error("Error adding submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: `فشل في إضافة البيانات: ${error.message}` });
      return null;
    }
  };

  const updateSubmissionStatus = async (submissionId: string, status: 'pending' | 'entered'): Promise<boolean> => {
    if (!db) {
      toast({ variant: "destructive", title: "خطأ", description: "قاعدة البيانات غير مهيأة." });
      return false;
    }
    if (!user || !user.isAdmin || user.id !== ADMIN_UID) {
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لتحديث الحالة."});
        return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, {
        status,
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.id,
        lastUpdatedByEmail: user.email,
       });
      await refreshData(); // Manually trigger refresh
      return true;
    } catch (error: any) {
      console.error("Error updating submission status:", error);
      toast({ variant: "destructive", title: "خطأ في تحديث الحالة", description: `فشل في تحديث الحالة: ${error.message}` });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail'>>): Promise<AdahiSubmission | null> => {
    if (!db) {
      toast({ variant: "destructive", title: "خطأ", description: "قاعدة البيانات غير مهيأة." });
      return null;
    }
    if (!user || !user.isAdmin || user.id !== ADMIN_UID) { 
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لتحديث البيانات."});
        return null;
    }

    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      const updateData = {
        ...data,
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.id,
        lastUpdatedByEmail: user.email,
      };
      await updateDoc(submissionDocRef, updateData);
      
      const updatedDocSnap = await getDoc(submissionDocRef); 
      if (updatedDocSnap.exists()) {
        const updatedDataFirebase = updatedDocSnap.data();
        const result = {
          id: updatedDocSnap.id,
          ...(updatedDataFirebase as Omit<AdahiSubmission, 'id' | 'submissionDate' | 'lastUpdated'>),
          submissionDate: updatedDataFirebase.submissionDate?.toDate ? updatedDataFirebase.submissionDate.toDate().toISOString() : new Date(updatedDataFirebase.submissionDate).toISOString(),
          lastUpdated: updatedDataFirebase.lastUpdated?.toDate ? updatedDataFirebase.lastUpdated.toDate().toISOString() : new Date(updatedDataFirebase.lastUpdated).toISOString(),
         } as AdahiSubmission;
         await refreshData(); // Manually trigger refresh
         return result;
      }
      return null;
    } catch (error: any) {
      console.error("Error updating submission:", error);
      toast({ variant: "destructive", title: "خطأ في تحديث البيانات", description: `فشل في تحديث البيانات: ${error.message}` });
      return null;
    }
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    if (!db) {
       toast({ variant: "destructive", title: "خطأ", description: "قاعدة البيانات غير مهيأة." });
      return false;
    }
    if (!user || !user.isAdmin || user.id !== ADMIN_UID) { 
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لحذف البيانات."});
        return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await deleteDoc(submissionDocRef);
      await refreshData(); // Manually trigger refresh
      return true;
    } catch (error: any) {
      console.error("Error deleting submission:", error);
      toast({ variant: "destructive", title: "خطأ في حذف البيانات", description: `فشل في حذف البيانات: ${error.message}` });
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
        user,
        loading,
        login,
        register,
        logout,
        submissions, 
        addSubmission,
        updateSubmissionStatus,
        updateSubmission,
        deleteSubmission,
        allSubmissionsForAdmin: allSubmissions, 
        fetchUserById,
        fetchUserByUsername,
        refreshData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

