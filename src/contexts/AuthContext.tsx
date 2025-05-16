
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
  fetchSignInMethodsForEmail,
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
  terminate,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<AppUser | null>;
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>;
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated" | "submitterUsername">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail' | "submitterUsername">>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[];
  fetchUserById: (userId: string) => Promise<AppUser | null>;
  fetchUserByUsername: (username: string) => Promise<AppUser | null>;
  refreshData: () => Promise<void>;
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
        console.log(`[AuthContext fetchUserById] User data for UID ${userId}:`, userData);
        return {
          id: userDocSnap.id,
          email: userData.email || "",
          username: userData.username || "مستخدم",
          isAdmin: userData.isAdmin === true || userId === ADMIN_UID,
        } as AppUser;
      } else {
         if (userId === ADMIN_UID) {
          console.log(`[AuthContext fetchUserById] No Firestore doc for ADMIN_UID ${userId}, returning admin shell.`);
          return {
            id: ADMIN_UID,
            email: process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com",
            username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin",
            isAdmin: true,
          };
        }
        console.log(`[AuthContext fetchUserById] No user document found for UID ${userId}.`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return null;
    }
  }, [toast]);

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
        console.log(`[AuthContext fetchUserByUsername] No user found with username: ${username}`);
        return null;
      }
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      if (typeof userData.email !== 'string' || typeof userData.username !== 'string') {
        console.error(`[AuthContext fetchUserByUsername] User document ${userDoc.id} has missing or invalid email/username fields.`);
        return null;
      }
      console.log(`[AuthContext fetchUserByUsername] User found for username ${username}:`, userData);
      return {
        id: userDoc.id,
        email: userData.email,
        username: userData.username,
        isAdmin: userData.isAdmin === true || userDoc.id === ADMIN_UID,
      } as AppUser;

    } catch (error) {
      console.error("Error fetching user by username:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب بيانات المستخدم." });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    if (!auth || !db) {
      console.warn("[AuthContext useEffect] Auth or DB service not available. Check Firebase configuration.");
      setLoading(false);
      setUser(null);
      return;
    }
    
    let isMounted = true;

    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("[AuthContext onAuthStateChanged] Triggered. FirebaseUser UID:", firebaseUser ? firebaseUser.uid : "null");
      if (!isMounted) {
        console.log("[AuthContext onAuthStateChanged] Component unmounted, aborting state update.");
        return;
      }
      setLoading(true);
      if (firebaseUser) {
        let appUser = await fetchUserById(firebaseUser.uid);
        
        if (appUser) {
            const finalAppUser: AppUser = {
                ...appUser,
                isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
            };
            console.log(`[AuthContext onAuthStateChanged] Firebase UID: ${firebaseUser.uid}, ADMIN_UID: ${ADMIN_UID}. Determined isAdmin: ${finalAppUser.isAdmin}`);
            console.log("[AuthContext onAuthStateChanged] Setting user (from appUser):", JSON.stringify(finalAppUser));
            if (isMounted) setUser(finalAppUser);
        } else {
            console.warn(`[AuthContext onAuthStateChanged] User with UID ${firebaseUser.uid} authenticated but no appUser profile returned from fetchUserById. Setting user to null.`);
            if (isMounted) setUser(null);
        }
      } else {
        console.log("[AuthContext onAuthStateChanged] No FirebaseUser, setting user to null.");
        if (isMounted) setUser(null);
      }
      console.log("[AuthContext onAuthStateChanged] Setting loading to false.");
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      console.log("[AuthContext useEffect] Unsubscribing from onAuthStateChanged.");
      unsubscribeAuthStateChanged();
    };
  }, [fetchUserById]);


  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز." });
      return null;
    }

    let emailToLogin = identifier;
    const isLoginByUsername = !(identifier.includes('@') && identifier.includes('.'));
    
    console.log(`[AuthContext Login] Attempting login with identifier: ${identifier}`);

    if (identifier === process.env.NEXT_PUBLIC_ADMIN_USERNAME && process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        emailToLogin = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        console.log(`[AuthContext Login] Admin login with username, using admin email: ${emailToLogin}`);
    } else if (isLoginByUsername && identifier !== (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin_default_username_placeholder")) {
        console.log(`[AuthContext Login] Regular user login with username: ${identifier}`);
        const userProfile = await fetchUserByUsername(identifier);
        if (userProfile && userProfile.email) {
            emailToLogin = userProfile.email;
            console.log(`[AuthContext Login] Username ${identifier} found, using email: ${emailToLogin}`);
        } else {
            toast({
                variant: "destructive",
                title: "خطأ في تسجيل الدخول",
                description: "اسم المستخدم غير موجود أو لم يتم العثور على بريد إلكتروني مطابق. يرجى مراعاة حالة الأحرف.",
            });
            console.log(`[AuthContext Login] Username ${identifier} not found or no email associated.`);
            return null;
        }
    } else {
      console.log(`[AuthContext Login] Login attempt with email (or admin username that resolves to admin email): ${identifier}`);
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      console.log(`[AuthContext Login] Firebase signInWithEmailAndPassword successful for UID: ${firebaseUser.uid}`);
      
      const appUser = await fetchUserById(firebaseUser.uid); 

      if (!appUser && firebaseUser.uid !== ADMIN_UID) {
          toast({ variant: "destructive", title: "خطأ في الحساب", description: "ملف تعريف المستخدم غير موجود في قاعدة البيانات." });
          console.warn(`[AuthContext Login] No app user profile for UID: ${firebaseUser.uid} and not ADMIN. Signing out.`);
          await signOut(auth);
          return null;
      }

      const finalAppUser: AppUser = appUser ? {
          ...appUser,
          isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
          username: (firebaseUser.uid === ADMIN_UID) ? (process.env.NEXT_PUBLIC_ADMIN_USERNAME || appUser.username || "Admin") : (appUser.username || "مستخدم"),
          email: (firebaseUser.uid === ADMIN_UID) ? (firebaseUser.email || process.env.NEXT_PUBLIC_ADMIN_EMAIL || appUser.email) : (firebaseUser.email || appUser.email),
      } : { 
          id: ADMIN_UID,
          email: emailToLogin, 
          username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin",
          isAdmin: true,
      };
      
      console.log(`[AuthContext Login] Login successful. Firebase UID: ${firebaseUser.uid}, ADMIN_UID: ${ADMIN_UID}. Determined isAdmin: ${finalAppUser.isAdmin}`);
      console.log("[AuthContext Login] Returning finalAppUser from login function:", JSON.stringify(finalAppUser));
      // setLoading(false); // Removed from here, onAuthStateChanged handles this
      return finalAppUser;

    } catch (error: any) {
      console.error("[AuthContext Login] Login error:", error);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        errorMessage += "البيانات المدخلة غير صحيحة.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += "الرجاء التحقق من بيانات الاعتماد أو الاتصال بالمسؤول.";
      }
      toast({ variant: "destructive", title: "خطأ في تسجيل الدخول", description: errorMessage });
      // setLoading(false); // Removed from here, onAuthStateChanged handles this
      return null;
    }
  };


  const register = async (username: string, email: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام التسجيل غير جاهز." });
      return null;
    }

    const arabicUsernameRegex = /^[\u0600-\u06FF\s\u0660-\u0669a-zA-Z0-9_.-]{3,}$/;
    if (!arabicUsernameRegex.test(username)) {
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل ويمكن أن يحتوي على حروف عربية، إنجليزية، أرقام، والرموز (- . _).", duration: 7000 });
      return null;
    }

    const existingUserByUsername = await fetchUserByUsername(username);
    if (existingUserByUsername) {
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم هذا موجود بالفعل. الرجاء اختيار اسم آخر." });
      return null;
    }
    
    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length > 0) {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "هذا البريد الإلكتروني مسجل بالفعل." });
        return null;
      }
    } catch (error: any) {
       console.error("[AuthContext Register] Error checking email existence:", error);
       if (error.code === 'auth/invalid-email') {
         toast({ variant: "destructive", title: "خطأ في التسجيل", description: "البريد الإلكتروني المدخل غير صالح." });
       } else {
         toast({ variant: "destructive", title: "خطأ في التسجيل", description: "حدث خطأ أثناء التحقق من البريد الإلكتروني." });
       }
       return null;
    }

    console.log(`[AuthContext Register] Attempting to register username: ${username}, email: ${email}`);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      console.log(`[AuthContext Register] Firebase user created with UID: ${firebaseUser.uid}`);

      const isAdminUser = firebaseUser.uid === ADMIN_UID;
      const newUserFirestoreData = {
        username,
        email: firebaseUser.email || email, 
        isAdmin: isAdminUser,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);
      console.log(`[AuthContext Register] User document created in Firestore for UID: ${firebaseUser.uid}`, newUserFirestoreData);
      
      const appUser: AppUser = {
        id: firebaseUser.uid,
        username: newUserFirestoreData.username,
        email: newUserFirestoreData.email,
        isAdmin: newUserFirestoreData.isAdmin,
      };
      toast({ title: "تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول." });
      return appUser; 
    } catch (error: any) {
      console.error("[AuthContext Register] Registration error:", error);
      let errorMessage = "فشل التسجيل. ";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage += "هذا البريد الإلكتروني مسجل بالفعل.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage += "كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage += "البريد الإلكتروني غير صالح.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += error.message || "حدث خطأ ما.";
      }
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: errorMessage });
      return null;
    }
  };


  const logout = async () => {
    if (!auth) {
        toast({variant: "destructive", title: "خطأ", description: "نظام تسجيل الخروج غير مهيأ."});
        return;
    }
    try {
        console.log("[AuthContext Logout] Attempting to sign out.");
        await signOut(auth);
        console.log("[AuthContext Logout] Sign out successful. Navigating to login.");
        router.push("/auth/login");
    } catch (error: any) {
        console.error("[AuthContext Logout] Logout error:", error);
        toast({variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج."});
    }
  };

  const refreshData = useCallback(async () => {
    if (!db || !user) {
      console.log("[AuthContext refreshData] Aborted: DB not ready or no user.");
      return;
    }
    console.log(`[AuthContext refreshData] Starting data refresh for user ID: ${user.id}, isAdmin: ${user.isAdmin}`);
    try {
      if (user.isAdmin) {
        console.log("[AuthContext refreshData] User is Admin. Fetching all submissions.");
        const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
        const adminSnapshot = await getDocs(adminQuery);
        const adminSubsPromises = adminSnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          let submitterUsername: string | undefined = data.submitterUsername || data.userEmail; 
           if (!data.submitterUsername && data.userId) { 
            const submitterProfile = await fetchUserById(data.userId);
            if (submitterProfile && submitterProfile.username) {
              submitterUsername = submitterProfile.username;
            }
          }
          return {
            id: docSnapshot.id, ...data,
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString()),
            submitterUsername,
          } as AdahiSubmission;
        });
        const resolvedAdminSubs = await Promise.all(adminSubsPromises);
        setAllSubmissions(resolvedAdminSubs);
        console.log("[AuthContext refreshData] Admin submissions fetched:", resolvedAdminSubs.length);
      }

      console.log(`[AuthContext refreshData] Fetching submissions for current user: ${user.id}`);
      const userQuery = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
      const userSnapshot = await getDocs(userQuery);
      const userSubs = userSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
            id: docSnapshot.id, ...data,
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString()),
        } as AdahiSubmission;
      });
      setSubmissions(userSubs);
      console.log("[AuthContext refreshData] User submissions fetched:", userSubs.length);

    } catch (error: any) {
        console.error("[AuthContext refreshData] Error refreshing data:", error);
        toast({variant: "destructive", title: "خطأ", description: `فشل في تحديث البيانات: ${error.message}`});
    } finally {
        console.log("[AuthContext refreshData] Data refresh complete.");
    }
  }, [db, user, toast, fetchUserById]);


  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated" | "submitterUsername">): Promise<AdahiSubmission | null> => {
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
        submitterUsername: user.username 
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
      
      await refreshData(); 

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
        submitterUsername: user.username,
      };
      return clientSideRepresentation;
    } catch (error: any) {
      console.error("[AuthContext addSubmission] Error adding submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: `فشل في إضافة البيانات: ${error.message}` });
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
      await updateDoc(submissionDocRef, {
        status,
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.id,
        lastUpdatedByEmail: user.email,
       });
      // await refreshData(); // No longer calling refreshData from here. It will be called from AdminSubmissionsTable.
      return true;
    } catch (error: any) {
      console.error("[AuthContext updateSubmissionStatus] Error updating status:", error);
      toast({ variant: "destructive", title: "خطأ في تحديث الحالة", description: `فشل في تحديث الحالة: ${error.message}` });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail' | 'submitterUsername'>>): Promise<AdahiSubmission | null> => {
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
      const updateData = {
        ...data,
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.id,
        lastUpdatedByEmail: user.email,
      };
      await updateDoc(submissionDocRef, updateData);
      // await refreshData(); // No longer calling refreshData from here. It will be called from AdminSubmissionsTable.


      const updatedDocSnap = await getDoc(submissionDocRef);
      if (updatedDocSnap.exists()) {
        const updatedDataFirebase = updatedDocSnap.data();
        let submitterUsername: string | undefined = updatedDataFirebase.submitterUsername || updatedDataFirebase.userEmail;
        if (!updatedDataFirebase.submitterUsername && updatedDataFirebase.userId) {
          const submitterProfile = await fetchUserById(updatedDataFirebase.userId);
          if (submitterProfile && submitterProfile.username) {
            submitterUsername = submitterProfile.username;
          }
        }

        const result = {
          id: updatedDocSnap.id,
          ...(updatedDataFirebase as Omit<AdahiSubmission, 'id' | 'submissionDate' | 'lastUpdated' | 'submitterUsername'>),
          submissionDate: updatedDataFirebase.submissionDate?.toDate ? updatedDataFirebase.submissionDate.toDate().toISOString() : (updatedDataFirebase.submissionDate ? new Date(updatedDataFirebase.submissionDate).toISOString() : new Date().toISOString()),
          lastUpdated: updatedDataFirebase.lastUpdated?.toDate ? updatedDataFirebase.lastUpdated.toDate().toISOString() : (updatedDataFirebase.lastUpdated ? new Date(updatedDataFirebase.lastUpdated).toISOString() : new Date().toISOString()),
          submitterUsername,
         } as AdahiSubmission;
         return result;
      }
      return null;
    } catch (error: any) {
      console.error("[AuthContext updateSubmission] Error updating submission:", error);
      toast({ variant: "destructive", title: "خطأ في تحديث البيانات", description: `فشل في تحديث البيانات: ${error.message}` });
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
      // await refreshData(); // No longer calling refreshData from here. It will be called from AdminSubmissionsTable.
      return true;
    } catch (error: any) {
      console.error("[AuthContext deleteSubmission] Error deleting submission:", error);
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

