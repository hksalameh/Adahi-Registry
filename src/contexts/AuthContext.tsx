
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
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const ADMIN_UID = "vqhrldpAdeWGcCgcMpWWRGdslOS2";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<AppUser | null>;
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>;
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated" | "submitterUsername" | "isSlaughtered" | "slaughterDate">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, newStatus: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail' | "submitterUsername" | "isSlaughtered" | "slaughterDate">>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[];
  fetchUserById: (userId: string) => Promise<AppUser | null>;
  fetchUserByUsername: (username: string) => Promise<AppUser | null>;
  refreshData: (currentUserForRefresh?: AppUser | null) => Promise<void>;
  markAsSlaughtered: (submissionId: string, donorName: string, phoneNumber: string) => Promise<boolean>;
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

  const fetchUserById = useCallback(async (userId: string): Promise<AppUser | null> => {
    if (!db) {
      console.error("[AuthContext fetchUserById] Firestore DB is not initialized.");
      return null;
    }
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        console.log("[AuthContext fetchUserById] User document found for ID:", userId, "Data:", userData);
        return {
          id: userDocSnap.id,
          email: userData.email || "",
          username: userData.username || "مستخدم",
          isAdmin: userData.isAdmin === true || userId === ADMIN_UID,
        } as AppUser;
      } else {
        console.warn(`[AuthContext fetchUserById] User document for ID: ${userId} does not exist.`);
        if (userId === ADMIN_UID) {
          console.log("[AuthContext fetchUserById] ADMIN_UID fallback triggered for ID:", userId);
          return {
            id: ADMIN_UID,
            email: "admin@example.com", 
            username: "Admin",
            isAdmin: true,
          };
        }
        console.log("[AuthContext fetchUserById] User not ADMIN_UID and document does not exist. Returning null for ID:", userId);
        return null;
      }
    } catch (error) {
      console.error(`[AuthContext fetchUserById] Error fetching user by ID ${userId}:`, error);
      return null;
    }
  }, []); // Removed toast from dependencies as it's not directly used for error reporting that affects flow

  const refreshData = useCallback(async (currentUserForRefresh?: AppUser | null) => {
    const effectiveUser = currentUserForRefresh || user;
    console.log("[AuthContext refreshData] Attempting to refresh data for effectiveUser:", JSON.stringify(effectiveUser));
    if (!db || !effectiveUser) {
      console.log("[AuthContext refreshData] DB not initialized or no effective user. Clearing submissions.");
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }

    // **أضف هذا السطر للتحقق:**
    console.log(`[AuthContext refreshData] User ID: ${effectiveUser.id}, Is Admin: ${effectiveUser.isAdmin}`);
    
    try {
      console.log("[AuthContext refreshData] Refreshing data for user ID:", effectiveUser.id, "isAdmin:", effectiveUser.isAdmin);
      if (effectiveUser.isAdmin) {
        const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
        const adminSnapshot = await getDocs(adminQuery);
        const adminSubsPromises = adminSnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          let submitterUsername: string | undefined = data.submitterUsername || data.userEmail;
          // Avoid calling fetchUserById if submitterUsername is already present to prevent potential loops or excessive calls
          if (!data.submitterUsername && data.userId && typeof fetchUserById === 'function') { 
            const submitterProfile = await fetchUserById(data.userId);
            if (submitterProfile && submitterProfile.username) {
              submitterUsername = submitterProfile.username;
            }
          }
          return {
            id: docSnapshot.id, ...data,
            submissionDate: data.submissionDate instanceof Timestamp ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString()),
            slaughterDate: data.slaughterDate instanceof Timestamp ? data.slaughterDate.toDate().toISOString() : (data.slaughterDate ? new Date(data.slaughterDate).toISOString() : undefined),
            submitterUsername,
          } as AdahiSubmission;
        });
        const resolvedAdminSubs = await Promise.all(adminSubsPromises);
        setAllSubmissions(resolvedAdminSubs);
        console.log("[AuthContext refreshData - Admin] Fetched submissions:", resolvedAdminSubs.length);
      }

      const userQuery = query(collection(db, "submissions"), where("userId", "==", effectiveUser.id), orderBy("submissionDate", "desc"));
      const userSnapshot = await getDocs(userQuery);
      const userSubs = userSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id, ...data,
          submissionDate: data.submissionDate instanceof Timestamp ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
          lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString()),
          slaughterDate: data.slaughterDate instanceof Timestamp ? data.slaughterDate.toDate().toISOString() : (data.slaughterDate ? new Date(data.slaughterDate).toISOString() : undefined),
        } as AdahiSubmission;
      });
      setSubmissions(userSubs);
      console.log("[AuthContext refreshData - User] Fetched submissions for", effectiveUser.id, ":", userSubs.length);
    } catch (error: any) {
      console.error("[AuthContext refreshData] Error refreshing data:", error);
      toast({ variant: "destructive", title: "خطأ", description: `فشل في تحديث البيانات: ${error.message}` });
    }
  }, [user, toast, fetchUserById]); // fetchUserById dependency is included

 useEffect(() => {
    let isMounted = true;
    if (!auth || !db) {
      console.warn("[AuthContext onAuthStateChanged] Firebase auth or db not initialized.");
      if (isMounted) setLoading(false);
      return;
    }
    console.log("[AuthContext onAuthStateChanged] Setting up listener. Initial loading state:", loading);

    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("[AuthContext onAuthStateChanged] State changed. FirebaseUser UID:", firebaseUser ? firebaseUser.uid : "null");
      if (!isMounted) {
        console.log("[AuthContext onAuthStateChanged] Component unmounted, exiting.");
        return;
      }
      
      try {
        if (firebaseUser) {
          console.log("[AuthContext onAuthStateChanged] Firebase user detected. Fetching app user data for UID:", firebaseUser.uid);
          let appUser = await fetchUserById(firebaseUser.uid);
          console.log("[AuthContext onAuthStateChanged] appUser from fetchUserById:", JSON.stringify(appUser));

          if (appUser) {
            const finalAppUser: AppUser = {
              ...appUser,
              isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
              username: (firebaseUser.uid === ADMIN_UID && (!appUser.username || appUser.username === "admin@example.com" || appUser.username === "Admin")) ? "Admin" : (appUser.username || "مستخدم"),
              email: firebaseUser.email || appUser.email || (firebaseUser.uid === ADMIN_UID ? "admin@example.com" : ""),
            };
            console.log("[AuthContext onAuthStateChanged] Constructed finalAppUser:", JSON.stringify(finalAppUser));
            if (isMounted) {
              setUser(finalAppUser);
              console.log("[AuthContext onAuthStateChanged] User state set. Calling refreshData with finalAppUser:", JSON.stringify(finalAppUser));
              await refreshData(finalAppUser);
              console.log("[AuthContext onAuthStateChanged] refreshData completed after user set.");
            }
          } else {
            console.warn("[AuthContext onAuthStateChanged] No app user data found (appUser is null/undefined after fetchUserById). Setting user to null. UID:", firebaseUser.uid);
            if (isMounted) {
              setUser(null);
              setSubmissions([]);
              setAllSubmissions([]);
            }
          }
        } else {
          console.log("[AuthContext onAuthStateChanged] No Firebase user, setting app user to null.");
          if (isMounted) {
            setUser(null);
            setSubmissions([]);
            setAllSubmissions([]);
          }
        }
      } catch (error) {
        console.error("[AuthContext onAuthStateChanged] Error processing auth state:", error);
        if (isMounted) {
          setUser(null); 
          setSubmissions([]);
          setAllSubmissions([]);
        }
      } finally {
        if (isMounted) {
          console.log("[AuthContext onAuthStateChanged] Finally block. Current loading state:", loading, "Setting loading to false.");
          setLoading(false);
        }
      }
    });

    return () => {
      console.log("[AuthContext onAuthStateChanged] Cleaning up listener.");
      isMounted = false;
      unsubscribeAuthStateChanged();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserById]); // refreshData removed from here

  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    console.log(`[AuthContext login] Attempting login with identifier: ${identifier}`);
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز." });
      setLoading(false); // Ensure loading is false
      return null;
    }
    
    let emailToLogin = "";
    const isAdminLoginAttempt = identifier === "Admin"; 
    const isLoginByEmail = identifier.includes('@') && identifier.includes('.');

    if (isAdminLoginAttempt) {
      // For admin, we use the email associated with ADMIN_UID if a direct document lookup is problematic
      // This relies on onAuthStateChanged to correctly identify the admin by UID
      // For now, let's try to get the admin's actual email if it exists, or use a placeholder
      const adminProfile = await fetchUserById(ADMIN_UID); // Attempt to get admin profile
      emailToLogin = adminProfile?.email || (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com"); // Fallback
      console.log(`[AuthContext login] Admin login attempt. Email to use: ${emailToLogin}`);

    } else if (!isLoginByEmail) {
      const userProfile = await fetchUserByUsername(identifier);
      if (userProfile && userProfile.email) {
        emailToLogin = userProfile.email;
      } else {
        toast({
          variant: "destructive",
          title: "خطأ في تسجيل الدخول",
          description: "اسم المستخدم غير موجود أو لم يتم العثور على بريد إلكتروني مطابق. يرجى مراعاة حالة الأحرف.",
        });
        setLoading(false); // Ensure loading is false
        return null;
      }
    } else {
      emailToLogin = identifier;
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      console.log("[AuthContext login] signInWithEmailAndPassword successful. FirebaseUser UID:", firebaseUser.uid);
      // onAuthStateChanged will handle setting the user and refreshing data.
      // Fetching user details here for immediate return to LoginForm.
      let appUser = await fetchUserById(firebaseUser.uid);
       if (!appUser && firebaseUser.uid !== ADMIN_UID) {
          console.error(`[AuthContext login] User ${firebaseUser.uid} authenticated but no profile found and not ADMIN_UID.`);
          toast({ variant: "destructive", title: "خطأ في الحساب", description: "تمت المصادقة ولكن ملف تعريف المستخدم غير موجود." });
          await signOut(auth); 
          setLoading(false);
          return null;
      }

      const finalAppUser: AppUser = appUser ? {
        ...appUser,
        isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
        username: (firebaseUser.uid === ADMIN_UID && (!appUser.username || appUser.username === "admin@example.com" || appUser.username === "Admin")) ? "Admin" : (appUser.username || "مستخدم"),
        email: firebaseUser.email || appUser.email || (firebaseUser.uid === ADMIN_UID ? "admin@example.com" : ""),
      } : { 
        id: ADMIN_UID,
        email: firebaseUser.email || "admin@example.com",
        username: "Admin",
        isAdmin: true,
      };
      console.log("[AuthContext login] Login successful. Returning finalAppUser:", JSON.stringify(finalAppUser));
      // setLoading(false) will be handled by onAuthStateChanged
      return finalAppUser; 
    } catch (error: any) {
      console.error("[AuthContext login] Login error:", error);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        errorMessage = "البيانات المدخلة غير صحيحة. يرجى التحقق من اسم المستخدم/البريد الإلكتروني وكلمة المرور.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "تم تعطيل الوصول إلى هذا الحساب مؤقتًا بسبب محاولات تسجيل دخول فاشلة. يمكنك استعادته أو المحاولة لاحقًا.";
      } else {
        errorMessage += error.message || "الرجاء التحقق من بيانات الاعتماد أو الاتصال بالمسؤول.";
      }
      toast({ variant: "destructive", title: "خطأ في تسجيل الدخول", description: errorMessage });
      setLoading(false); // Ensure loading is false on error
      return null;
    }
  };

  const register = async (username: string, email: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام التسجيل غير جاهز." });
      setLoading(false);
      return null;
    }

    const arabicUsernameRegex = /^[\u0600-\u06FF\s\u0660-\u0669a-zA-Z0-9_.-]{3,}$/;
    if (!arabicUsernameRegex.test(username)) {
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.", duration: 7000 });
      setLoading(false);
      return null;
    }
    
    try {
      const existingUserByUsername = await fetchUserByUsername(username);
      if (existingUserByUsername) {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم هذا موجود بالفعل." });
        setLoading(false);
        return null;
      }

      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length > 0) {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "هذا البريد الإلكتروني مسجل بالفعل." });
        setLoading(false);
        return null;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      const isAdminUser = firebaseUser.uid === ADMIN_UID;
      const newUserFirestoreData = {
        username,
        email: firebaseUser.email || email,
        isAdmin: isAdminUser,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);
      
      const appUser: AppUser = {
        id: firebaseUser.uid,
        username: newUserFirestoreData.username,
        email: newUserFirestoreData.email,
        isAdmin: newUserFirestoreData.isAdmin,
      };
      toast({ title: "تم تسجيل المستخدم بنجاح!" });
      // onAuthStateChanged will handle user and loading
      return appUser;
    } catch (error: any) {
      console.error("[AuthContext register] Error creating user:", error);
      let errorMessage = "فشل التسجيل. ";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "هذا البريد الإلكتروني مسجل بالفعل.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "كلمة المرور ضعيفة جداً (6 أحرف على الأقل).";
      } else {
        errorMessage += error.message || "حدث خطأ ما.";
      }
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: errorMessage });
      setLoading(false);
      return null;
    }
  };

  const logout = async () => {
    if (!auth) {
      toast({ variant: "destructive", title: "خطأ", description: "نظام تسجيل الخروج غير مهيأ." });
      setLoading(false);
      return;
    }
    try {
      await signOut(auth);
      // onAuthStateChanged will handle setUser(null) and loading state.
    } catch (error: any) {
      console.error("[AuthContext logout] Sign out error:", error);
      toast({ variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج." });
      setLoading(false); 
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated" | "submitterUsername" | "isSlaughtered" | "slaughterDate">): Promise<AdahiSubmission | null> => {
    if (!db || !user) {
      toast({ variant: "destructive", title: "خطأ", description: !db ? "قاعدة البيانات غير مهيأة." : "يجب تسجيل الدخول أولاً." });
      if (!user) router.push(`/auth/login?redirect=${pathname}`);
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
        submitterUsername: user.username,
        isSlaughtered: false,
        slaughterDate: null,
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
      await refreshData(); 
      const clientSideRepresentation: AdahiSubmission = {
        ...newSubmissionData,
        id: docRef.id,
        submissionDate: new Date().toISOString(), 
        lastUpdated: new Date().toISOString(), 
        isSlaughtered: false,
        slaughterDate: undefined,
      };
      return clientSideRepresentation;
    } catch (error: any) {
      console.error("[AuthContext addSubmission] Error adding submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: `فشل في إضافة البيانات: ${error.message}` });
      return null;
    }
  };

  const updateSubmissionStatus = async (submissionId: string, newStatus: 'pending' | 'entered'): Promise<boolean> => {
    if (!db || !user || !user.isAdmin) {
      toast({ variant: "destructive", title: "غير مصرح به", description: !db ? "قاعدة البيانات غير مهيأة." : (!user ? "يجب تسجيل الدخول" : "ليس لديك صلاحية لتحديث الحالة.") });
      return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, {
        status: newStatus,
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.id,
        lastUpdatedByEmail: user.email,
      });
      await refreshData(); 
      return true;
    } catch (error: any) {
      console.error("[AuthContext updateSubmissionStatus] Error updating status:", error);
      toast({ variant: "destructive", title: "خطأ في تحديث الحالة", description: `فشل في تحديث الحالة: ${error.message}` });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail' | 'submitterUsername' | "isSlaughtered" | "slaughterDate">>): Promise<AdahiSubmission | null> => {
    if (!db || !user || !user.isAdmin) {
      toast({ variant: "destructive", title: "غير مصرح به", description: !db ? "قاعدة البيانات غير مهيأة." : (!user ? "يجب تسجيل الدخول" : "ليس لديك صلاحية لتحديث البيانات.") });
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
        let submitterUsername: string | undefined = updatedDataFirebase.submitterUsername || updatedDataFirebase.userEmail;
        if (!updatedDataFirebase.submitterUsername && updatedDataFirebase.userId && typeof fetchUserById === 'function') {
          const submitterProfile = await fetchUserById(updatedDataFirebase.userId);
          if (submitterProfile && submitterProfile.username) {
            submitterUsername = submitterProfile.username;
          }
        }
        const result = {
          id: updatedDocSnap.id,
          ...(updatedDataFirebase as Omit<AdahiSubmission, 'id' | 'submissionDate' | 'lastUpdated' | 'submitterUsername' | 'slaughterDate'>),
          submissionDate: updatedDataFirebase.submissionDate instanceof Timestamp ? updatedDataFirebase.submissionDate.toDate().toISOString() : (updatedDataFirebase.submissionDate ? new Date(updatedDataFirebase.submissionDate).toISOString() : new Date().toISOString()),
          lastUpdated: updatedDataFirebase.lastUpdated instanceof Timestamp ? updatedDataFirebase.lastUpdated.toDate().toISOString() : (updatedDataFirebase.lastUpdated ? new Date(updatedDataFirebase.lastUpdated).toISOString() : new Date().toISOString()),
          slaughterDate: updatedDataFirebase.slaughterDate instanceof Timestamp ? updatedDataFirebase.slaughterDate.toDate().toISOString() : (updatedDataFirebase.slaughterDate ? new Date(updatedDataFirebase.slaughterDate).toISOString() : undefined),
          submitterUsername,
        } as AdahiSubmission;
        await refreshData(); 
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
    if (!db || !user || !user.isAdmin) {
      toast({ variant: "destructive", title: "غير مصرح به", description: !db ? "قاعدة البيانات غير مهيأة." : (!user ? "يجب تسجيل الدخول" : "ليس لديك صلاحية لحذف البيانات.") });
      return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await deleteDoc(submissionDocRef);
      await refreshData(); 
      return true;
    } catch (error: any) {
      console.error("[AuthContext deleteSubmission] Error deleting submission:", error);
      toast({ variant: "destructive", title: "خطأ في حذف البيانات", description: `فشل في حذف البيانات: ${error.message}` });
      return false;
    }
  };
  
  const fetchUserByUsername = useCallback(async (username: string): Promise<AppUser | null> => {
    if (!db) {
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

      if (typeof userData.email !== 'string' || typeof userData.username !== 'string') {
        console.error(`[AuthContext fetchUserByUsername] User document ${userDoc.id} has missing or invalid email/username fields.`);
        return null;
      }
      return {
        id: userDoc.id,
        email: userData.email,
        username: userData.username,
        isAdmin: userData.isAdmin === true || userDoc.id === ADMIN_UID,
      } as AppUser;
    } catch (error) {
      console.error("[AuthContext fetchUserByUsername] Error fetching user by username:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب بيانات المستخدم." });
      return null;
    }
  }, [toast]);

  const markAsSlaughtered = async (submissionId: string, donorName: string, phoneNumber: string): Promise<boolean> => {
    if (!db || !user || !user.isAdmin) {
      toast({ variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لتحديث حالة الذبح." });
      return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, {
        isSlaughtered: true,
        slaughterDate: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.id,
        lastUpdatedByEmail: user.email,
      });

      const message = `السيد/السيدة ${donorName} تقبل الله طاعتكم وكل عام وانتم بالف خير تم ذبح اضحيتك ربنا يتقبل منكم`;
      let formattedPhoneNumber = phoneNumber.startsWith("0") ? phoneNumber.substring(1) : phoneNumber;
      if (!formattedPhoneNumber.startsWith("962")) {
        formattedPhoneNumber = `962${formattedPhoneNumber}`;
      }
      
      const whatsappUrl = `https://wa.me/${formattedPhoneNumber}?text=${encodeURIComponent(message)}`;
      const smsUri = `sms:${formattedPhoneNumber}?body=${encodeURIComponent(message)}`;
      
      if (typeof window !== "undefined") {
        window.open(whatsappUrl, '_blank');
        setTimeout(() => {
          if (typeof window !== "undefined") { 
            window.open(smsUri, '_blank');
          }
        }, 1000);
      }

      toast({ title: "تم تسجيل الذبح بنجاح", description: `سيتم محاولة فتح WhatsApp وتطبيق الرسائل لإشعار ${donorName}.` });
      await refreshData(); 
      return true;
    } catch (error: any) {
      console.error("[AuthContext markAsSlaughtered] Error marking as slaughtered:", error);
      toast({ variant: "destructive", title: "خطأ", description: `فشل تحديث حالة الذبح: ${error.message}` });
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
      refreshData,
      markAsSlaughtered
    }}>
      {children}
    </AuthContext.Provider>
  );
};