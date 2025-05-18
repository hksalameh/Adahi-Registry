
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
    console.log(`[AuthContext fetchUserById] Fetching user by ID: ${userId}`);
    if (!db) {
      console.error("[AuthContext fetchUserById] Firestore DB is not initialized.");
      return null;
    }
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        console.log(`[AuthContext fetchUserById] User document for ID: ${userId} exists: true, data:`, userData);
        return {
          id: userDocSnap.id,
          email: userData.email || "",
          username: userData.username || "مستخدم",
          isAdmin: userData.isAdmin === true || userId === ADMIN_UID,
        } as AppUser;
      } else {
        console.warn(`[AuthContext fetchUserById] User document for ID: ${userId} exists: false`);
        if (userId === ADMIN_UID) {
          console.log("[AuthContext fetchUserById] User is ADMIN_UID, returning default admin profile.");
          return {
            id: ADMIN_UID,
            email: "admin@example.com", // Placeholder, will be overwritten by FirebaseUser.email if available
            username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin",
            isAdmin: true,
          };
        }
        return null;
      }
    } catch (error) {
      console.error(`[AuthContext fetchUserById] Error fetching user by ID ${userId}:`, error);
      return null;
    }
  }, []);

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

  const refreshData = useCallback(async (currentUserForRefresh?: AppUser | null) => {
    const effectiveUser = currentUserForRefresh || user;
    console.log(`[AuthContext refreshData] Called. Effective user ID: ${effectiveUser?.id}, isAdmin: ${effectiveUser?.isAdmin}`);
    if (!db || !effectiveUser) {
      console.log("[AuthContext refreshData] DB not initialized or no effective user. Clearing submissions.");
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }
    try {
      if (effectiveUser.isAdmin) {
        console.log("[AuthContext refreshData] Fetching admin submissions.");
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
            submissionDate: data.submissionDate instanceof Timestamp ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString()),
            slaughterDate: data.slaughterDate instanceof Timestamp ? data.slaughterDate.toDate().toISOString() : (data.slaughterDate ? new Date(data.slaughterDate).toISOString() : undefined),
            submitterUsername,
          } as AdahiSubmission;
        });
        const resolvedAdminSubs = await Promise.all(adminSubsPromises);
        setAllSubmissions(resolvedAdminSubs);
        console.log(`[AuthContext refreshData] Fetched ${resolvedAdminSubs.length} admin submissions.`);
      }

      console.log(`[AuthContext refreshData] Fetching submissions for user ID: ${effectiveUser.id}`);
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
      console.log(`[AuthContext refreshData] Fetched ${userSubs.length} submissions for user ${effectiveUser.id}.`);

    } catch (error: any) {
      console.error("[AuthContext refreshData] Error refreshing data:", error);
      toast({ variant: "destructive", title: "خطأ", description: `فشل في تحديث البيانات: ${error.message}` });
    }
  }, [user, toast, fetchUserById]); // Added fetchUserById to dependency array

  useEffect(() => {
    let isMounted = true;
    if (!auth || !db) {
      if (isMounted) {
        console.log("[AuthContext useEffect] Firebase not initialized. Setting loading to false.");
        setLoading(false);
      }
      return;
    }

    console.log("[AuthContext useEffect] Setting up onAuthStateChanged listener.");
    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!isMounted) {
        console.log("[AuthContext onAuthStateChanged] Component unmounted. Aborting.");
        return;
      }
      console.log("[AuthContext onAuthStateChanged] Triggered. FirebaseUser UID:", firebaseUser ? firebaseUser.uid : 'null');
      try {
        if (firebaseUser) {
          console.log(`[AuthContext onAuthStateChanged] Before fetchUserById for UID: ${firebaseUser.uid}`);
          let appUser = await fetchUserById(firebaseUser.uid);
          console.log(`[AuthContext onAuthStateChanged] After fetchUserById. appUser:`, appUser);

          if (appUser) {
            const finalAppUser: AppUser = {
              ...appUser,
              isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
              username: (firebaseUser.uid === ADMIN_UID && !appUser.username) ? (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin") : (appUser.username || "مستخدم"),
              email: firebaseUser.email || appUser.email,
            };
            console.log(`[AuthContext onAuthStateChanged] finalAppUser:`, finalAppUser);
            if (isMounted) {
              console.log(`[AuthContext onAuthStateChanged] Calling setUser with:`, finalAppUser);
              setUser(finalAppUser);
              console.log("[AuthContext onAuthStateChanged] Calling refreshData...");
              await refreshData(finalAppUser);
            }
          } else {
            // This case should ideally not happen if fetchUserById handles ADMIN_UID correctly
            console.warn(`[AuthContext onAuthStateChanged] appUser is null for firebaseUser UID: ${firebaseUser.uid}. Setting user to null.`);
            if (isMounted) setUser(null);
          }
        } else {
          console.log("[AuthContext onAuthStateChanged] No firebaseUser. Setting user to null and clearing submissions.");
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
          console.log("[AuthContext onAuthStateChanged] Setting loading to false in finally.");
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      console.log("[AuthContext useEffect] Cleaning up onAuthStateChanged listener.");
      unsubscribeAuthStateChanged();
    };
  }, [fetchUserById, refreshData]); // refreshData and fetchUserById are stable due to useCallback

  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    console.log(`[AuthContext login] Attempting login for identifier: ${identifier}`);
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز." });
      setLoading(false); // Ensure loading is set to false
      return null;
    }
    
    let emailToLogin = "";
    const isAdminLoginAttempt = identifier === (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin");
    const isLoginByEmail = identifier.includes('@') && identifier.includes('.');

    if (isAdminLoginAttempt && process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      emailToLogin = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
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
        setLoading(false); // Ensure loading is set to false
        return null;
      }
    } else {
      emailToLogin = identifier;
    }
    
    setLoading(true); // Set loading true before async operation
    try {
      console.log(`[AuthContext login] Signing in with email: ${emailToLogin}`);
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      // onAuthStateChanged will fetch user doc and set user state
      // But to return the user immediately for redirection logic:
      let appUser = await fetchUserById(firebaseUser.uid);
      if (!appUser && firebaseUser.uid !== ADMIN_UID) {
          // This should not happen if user exists in auth but not users collection, unless it's the admin without a users doc.
          console.error(`[AuthContext login] User ${firebaseUser.uid} authenticated but no profile found in Firestore and not ADMIN_UID.`);
          toast({ variant: "destructive", title: "خطأ في الحساب", description: "تمت المصادقة ولكن ملف تعريف المستخدم غير موجود." });
          await signOut(auth); // Log out the partially logged-in user
          setLoading(false);
          return null;
      }

      const finalAppUser: AppUser = appUser ? {
        ...appUser,
        isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
        username: (firebaseUser.uid === ADMIN_UID && !appUser.username) ? (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin") : (appUser.username || "مستخدم"),
        email: firebaseUser.email || appUser.email,
      } : { // Fallback for ADMIN_UID if no users doc (should be handled by fetchUserById)
        id: ADMIN_UID,
        email: firebaseUser.email || "admin@example.com", // Use email from firebaseUser if available
        username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin",
        isAdmin: true,
      };
      console.log(`[AuthContext login] Login successful. finalAppUser:`, finalAppUser);
      // setLoading(false) will be handled by onAuthStateChanged
      return finalAppUser;
    } catch (error: any) {
      console.error("[AuthContext login] Login error:", error);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        errorMessage = "البيانات المدخلة غير صحيحة. يرجى التحقق من اسم المستخدم/البريد الإلكتروني وكلمة المرور.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += error.message || "الرجاء التحقق من بيانات الاعتماد أو الاتصال بالمسؤول.";
      }
      toast({ variant: "destructive", title: "خطأ في تسجيل الدخول", description: errorMessage });
      setLoading(false); // Ensure loading is set to false on error
      return null;
    }
    // No finally setLoading(false) here, as onAuthStateChanged should handle it upon successful login.
    // However, if login fails before onAuthStateChanged triggers (e.g. wrong password), we need to set it.
  };

  const register = async (username: string, email: string, pass: string): Promise<AppUser | null> => {
    console.log(`[AuthContext register] Attempting to register username: ${username}, email: ${email}`);
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام التسجيل غير جاهز." });
      setLoading(false);
      return null;
    }

    const arabicUsernameRegex = /^[\u0600-\u06FF\s\u0660-\u0669a-zA-Z0-9_.-]{3,}$/;
    if (!arabicUsernameRegex.test(username)) {
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل ويمكن أن يحتوي على حروف عربية، إنجليزية، أرقام، والرموز (- . _).", duration: 7000 });
      setLoading(false);
      return null;
    }
    
    setLoading(true);
    try {
      const existingUserByUsername = await fetchUserByUsername(username);
      if (existingUserByUsername) {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم هذا موجود بالفعل. الرجاء اختيار اسم آخر." });
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
      console.log(`[AuthContext register] User ${username} registered successfully. Firestore doc created.`);
      
      const appUser: AppUser = {
        id: firebaseUser.uid,
        username: newUserFirestoreData.username,
        email: newUserFirestoreData.email,
        isAdmin: newUserFirestoreData.isAdmin,
      };
      toast({ title: "تم تسجيل المستخدم بنجاح!" });
      // onAuthStateChanged will handle setting user and loading to false
      return appUser;
    } catch (error: any) {
      console.error("[AuthContext register] Error creating user:", error);
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
      setLoading(false);
      return null;
    }
    // No finally setLoading(false) here, as onAuthStateChanged should handle it upon successful registration.
  };

  const logout = async () => {
    console.log("[AuthContext logout] Attempting logout.");
    if (!auth) {
      toast({ variant: "destructive", title: "خطأ", description: "نظام تسجيل الخروج غير مهيأ." });
      return;
    }
    setLoading(true); // Set loading true before async operation
    try {
      await signOut(auth);
      // onAuthStateChanged will handle setUser(null), submissions, and ultimately setLoading(false)
      // No need to explicitly push router here, as HomePage logic or layout logic should handle redirection based on user state.
      console.log("[AuthContext logout] Sign out successful. User state will be updated by onAuthStateChanged.");
    } catch (error: any) {
      console.error("[AuthContext logout] Sign out error:", error);
      toast({ variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج." });
      setLoading(false); // Ensure loading is false if signOut itself errors
    }
    // onAuthStateChanged will call setLoading(false) in its finally block.
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
        submissionDate: new Date().toISOString(), // Approximate for client-side
        lastUpdated: new Date().toISOString(), // Approximate for client-side
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
        if (!updatedDataFirebase.submitterUsername && updatedDataFirebase.userId) {
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
          if (typeof window !== "undefined") window.open(smsUri, '_blank');
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

    