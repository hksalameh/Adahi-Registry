
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

// تعريف UID الخاص بالمدير مباشرة
const ADMIN_UID = "vqhrldpAdeWGcCgcMpWWRGdslOS2";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<AppUser | null>;
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>;
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated" | "submitterUsername" | "isSlaughtered" | "slaughterDate">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail' | "submitterUsername" | "isSlaughtered" | "slaughterDate">>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[];
  fetchUserById: (userId: string) => Promise<AppUser | null>;
  fetchUserByUsername: (username: string) => Promise<AppUser | null>;
  refreshData: () => Promise<void>;
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
      console.error("AuthContext: Firestore DB is not initialized for fetchUserById.");
      return null;
    }
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        // console.log(`[AuthContext fetchUserById] User data for UID ${userId}:`, userData);
        return {
          id: userDocSnap.id,
          email: userData.email || "",
          username: userData.username || "مستخدم",
          isAdmin: userData.isAdmin === true || userId === ADMIN_UID,
        } as AppUser;
      } else {
         if (userId === ADMIN_UID) {
          // console.log(`[AuthContext fetchUserById] No Firestore doc for ADMIN_UID ${userId}, returning admin shell.`);
          return {
            id: ADMIN_UID,
            email: "admin@example.com", // يمكنك استخدام قيمة افتراضية أو متغير بيئة هنا
            username: "Admin", // يمكنك استخدام قيمة افتراضية أو متغير بيئة هنا
            isAdmin: true,
          };
        }
        // console.log(`[AuthContext fetchUserById] No user document found for UID ${userId}.`);
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
        // console.log(`[AuthContext fetchUserByUsername] No user found with username: ${username}`);
        return null;
      }
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      if (typeof userData.email !== 'string' || typeof userData.username !== 'string') {
        console.error(`[AuthContext fetchUserByUsername] User document ${userDoc.id} has missing or invalid email/username fields.`);
        return null;
      }
      // console.log(`[AuthContext fetchUserByUsername] User found for username ${username}:`, userData);
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

  const refreshData = useCallback(async (currentUserForRefresh: AppUser | null = user) => {
    const effectiveUser = currentUserForRefresh || user;
    if (!db || !effectiveUser) {
      // console.log("[AuthContext refreshData] Aborted: DB not ready or no effective user.", { dbReady: !!db, userExists: !!effectiveUser });
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }
    // console.log(`[AuthContext refreshData] Starting data refresh for user ID: ${effectiveUser.id}, isAdmin: ${effectiveUser.isAdmin}`);
    try {
      if (effectiveUser.isAdmin) {
        // console.log("[AuthContext refreshData] User is Admin. Fetching all submissions.");
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
            slaughterDate: data.slaughterDate?.toDate ? data.slaughterDate.toDate().toISOString() : (data.slaughterDate ? new Date(data.slaughterDate).toISOString() : undefined),
            submitterUsername,
          } as AdahiSubmission;
        });
        const resolvedAdminSubs = await Promise.all(adminSubsPromises);
        setAllSubmissions(resolvedAdminSubs);
        // console.log("[AuthContext refreshData] Admin submissions fetched:", resolvedAdminSubs.length);
      }

      // console.log(`[AuthContext refreshData - User] Fetching submissions for current user: ${effectiveUser.id}`);
      const userQuery = query(collection(db, "submissions"), where("userId", "==", effectiveUser.id), orderBy("submissionDate", "desc"));
      const userSnapshot = await getDocs(userQuery);
      const userSubs = userSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
            id: docSnapshot.id, ...data,
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString()),
            slaughterDate: data.slaughterDate?.toDate ? data.slaughterDate.toDate().toISOString() : (data.slaughterDate ? new Date(data.slaughterDate).toISOString() : undefined),
        } as AdahiSubmission;
      });
      setSubmissions(userSubs);
      // console.log("[AuthContext refreshData - User] User submissions fetched:", userSubs.length, userSubs);

    } catch (error: any) {
        console.error("[AuthContext refreshData] Error refreshing data:", error);
        toast({variant: "destructive", title: "خطأ", description: `فشل في تحديث البيانات: ${error.message}`});
    } finally {
        // console.log("[AuthContext refreshData] Data refresh complete.");
    }
  }, [db, user, toast, fetchUserById]);


  useEffect(() => {
    if (!auth || !db) {
      // console.warn("[AuthContext useEffect onAuthStateChanged] Auth or DB service not available. Check Firebase configuration.");
      setLoading(false);
      setUser(null);
      return;
    }
    
    let isMounted = true;

    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      // console.log("[AuthContext onAuthStateChanged] Triggered. FirebaseUser UID:", firebaseUser ? firebaseUser.uid : "null");
      if (!isMounted) {
        // console.log("[AuthContext onAuthStateChanged] Component unmounted, aborting state update.");
        return;
      }
      setLoading(true);
      if (firebaseUser) {
        let appUser = await fetchUserById(firebaseUser.uid);
        
        if (appUser) {
            const finalAppUser: AppUser = {
                ...appUser,
                isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
                username: (firebaseUser.uid === ADMIN_UID && !appUser.username) ? "Admin" : appUser.username,
                email: firebaseUser.email || appUser.email, // Prioritize Firebase email if available
            };
            // console.log(`[AuthContext onAuthStateChanged] Firebase UID: ${firebaseUser.uid}, ADMIN_UID: ${ADMIN_UID}. Determined isAdmin: ${finalAppUser.isAdmin}`);
            // console.log("[AuthContext onAuthStateChanged] Setting user (from appUser):", JSON.stringify(finalAppUser));
            if (isMounted) {
              setUser(finalAppUser);
              await refreshData(finalAppUser); 
            }
        } else {
            // console.warn(`[AuthContext onAuthStateChanged] User with UID ${firebaseUser.uid} authenticated but no appUser profile returned from fetchUserById. Setting user to null.`);
            if (isMounted) setUser(null);
        }
      } else {
        // console.log("[AuthContext onAuthStateChanged] No FirebaseUser, setting user to null.");
        if (isMounted) {
          setUser(null);
          setSubmissions([]); 
          setAllSubmissions([]); 
        }
      }
      // console.log("[AuthContext onAuthStateChanged] Setting loading to false.");
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      // console.log("[AuthContext useEffect] Unsubscribing from onAuthStateChanged.");
      unsubscribeAuthStateChanged();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserById]);


  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز." });
      return null;
    }

    let emailToLogin = identifier;
    const isAdminLoginAttempt = identifier === (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin");
    const isLoginByEmail = identifier.includes('@') && identifier.includes('.');

    // console.log(`[AuthContext Login] Attempting login with identifier: ${identifier}. isAdminLoginAttempt: ${isAdminLoginAttempt}, isLoginByEmail: ${isLoginByEmail}`);

    if (isAdminLoginAttempt && process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        emailToLogin = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        // console.log(`[AuthContext Login] Admin login attempt with username, using admin email: ${emailToLogin}`);
    } else if (!isLoginByEmail && !isAdminLoginAttempt) {
        // console.log(`[AuthContext Login] Regular user login attempt with username: ${identifier}`);
        const userProfile = await fetchUserByUsername(identifier);
        if (userProfile && userProfile.email) {
            emailToLogin = userProfile.email;
            // console.log(`[AuthContext Login] Username ${identifier} found, using email: ${emailToLogin}`);
        } else {
            toast({
                variant: "destructive",
                title: "خطأ في تسجيل الدخول",
                description: "اسم المستخدم غير موجود أو لم يتم العثور على بريد إلكتروني مطابق. يرجى مراعاة حالة الأحرف.",
            });
            // console.log(`[AuthContext Login] Username ${identifier} not found or no email associated.`);
            return null;
        }
    } else {
      // console.log(`[AuthContext Login] Login attempt with email: ${identifier}`);
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      // console.log(`[AuthContext Login] Firebase signInWithEmailAndPassword successful for UID: ${firebaseUser.uid}`);
      
      const appUser = await fetchUserById(firebaseUser.uid); 

      if (!appUser && firebaseUser.uid !== ADMIN_UID) {
          toast({ variant: "destructive", title: "خطأ في الحساب", description: "ملف تعريف المستخدم غير موجود في قاعدة البيانات." });
          // console.warn(`[AuthContext Login] No app user profile for UID: ${firebaseUser.uid} and not ADMIN. Signing out.`);
          await signOut(auth);
          return null;
      }
      
      const finalAppUser: AppUser = appUser ? {
          ...appUser,
          isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
          username: (firebaseUser.uid === ADMIN_UID && !appUser.username) ? (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin") : (appUser.username || "مستخدم"),
          email: firebaseUser.email || appUser.email, // Prioritize Firebase email if available
      } : { 
          id: ADMIN_UID,
          email: emailToLogin, 
          username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin",
          isAdmin: true,
      };
      
      // console.log(`[AuthContext Login] Login successful. Firebase UID: ${firebaseUser.uid}, ADMIN_UID: ${ADMIN_UID}. Determined isAdmin: ${finalAppUser.isAdmin}`);
      // console.log("[AuthContext Login] Returning finalAppUser from login function:", JSON.stringify(finalAppUser));
      setUser(finalAppUser); // Set user in context immediately
      // setLoading(false); // setLoading is handled by onAuthStateChanged
      return finalAppUser;

    } catch (error: any) {
      // console.error("[AuthContext Login] Login error:", error);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        errorMessage = "البيانات المدخلة غير صحيحة. يرجى التحقق من اسم المستخدم/البريد الإلكتروني وكلمة المرور.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += "الرجاء التحقق من بيانات الاعتماد أو الاتصال بالمسؤول.";
      }
      toast({ variant: "destructive", title: "خطأ في تسجيل الدخول", description: errorMessage });
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

    try {
      // 1. تحقق مما إذا كان اسم المستخدم موجودًا بالفعل في Firestore
      const existingUserByUsername = await fetchUserByUsername(username);
      if (existingUserByUsername) {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم هذا موجود بالفعل. الرجاء اختيار اسم آخر." });
        return null;
      }

      // 2. تحقق مما إذا كان البريد الإلكتروني مستخدمًا بالفعل في Firebase Auth
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length > 0) {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "هذا البريد الإلكتروني مسجل بالفعل." });
        return null;
      }
    } catch (error: any) {
       console.error("[AuthContext Register] Error checking username/email existence:", error);
       let checkErrorMsg = "حدث خطأ أثناء التحقق من توفر اسم المستخدم/البريد الإلكتروني.";
       if (error.code === 'auth/invalid-email') {
         checkErrorMsg = "البريد الإلكتروني المدخل غير صالح.";
       }
       toast({ variant: "destructive", title: "خطأ في التسجيل", description: checkErrorMsg });
       return null;
    }
    
    // console.log(`[AuthContext Register] Attempting to register username: ${username}, email: ${email}`);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      // console.log(`[AuthContext Register] Firebase user created with UID: ${firebaseUser.uid}`);

      const isAdminUser = firebaseUser.uid === ADMIN_UID;
      const newUserFirestoreData = {
        username,
        email: firebaseUser.email || email, 
        isAdmin: isAdminUser,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);
      // console.log(`[AuthContext Register] User document created in Firestore for UID: ${firebaseUser.uid}`, newUserFirestoreData);
      
      const appUser: AppUser = {
        id: firebaseUser.uid,
        username: newUserFirestoreData.username,
        email: newUserFirestoreData.email,
        isAdmin: newUserFirestoreData.isAdmin,
      };
      toast({ title: "تم تسجيل المستخدم بنجاح!" });
      refreshData(); // لتحديث قائمة المستخدمين إذا كان المدير هو من يقوم بالتسجيل
      return appUser; 
    } catch (error: any) {
      // console.error("[AuthContext Register] Registration error:", error);
      let errorMessage = "فشل التسجيل. ";
      if (error.code === 'auth/email-already-in-use') { // هذا يجب أن يتم التقاطه في التحقق المسبق، ولكن كإجراء احتياطي
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
        // console.log("[AuthContext Logout] Attempting to sign out.");
        await signOut(auth);
        // console.log("[AuthContext Logout] Sign out successful. Navigating to login.");
        router.push("/auth/login");
    } catch (error: any) {
        // console.error("[AuthContext Logout] Logout error:", error);
        toast({variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج."});
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated" | "submitterUsername" | "isSlaughtered" | "slaughterDate">): Promise<AdahiSubmission | null> => {
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
        submitterUsername: user.username,
        isSlaughtered: false, 
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
        isSlaughtered: false,
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
      await refreshData(); 
      return true;
    } catch (error: any) {
      console.error("[AuthContext updateSubmissionStatus] Error updating status:", error);
      toast({ variant: "destructive", title: "خطأ في تحديث الحالة", description: `فشل في تحديث الحالة: ${error.message}` });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail' | 'submitterUsername' | "isSlaughtered" | "slaughterDate">>): Promise<AdahiSubmission | null> => {
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
      

      const updatedDocSnap = await getDoc(submissionDocRef); // Re-fetch for accurate data
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
          submissionDate: updatedDataFirebase.submissionDate?.toDate ? updatedDataFirebase.submissionDate.toDate().toISOString() : (updatedDataFirebase.submissionDate ? new Date(updatedDataFirebase.submissionDate).toISOString() : new Date().toISOString()),
          lastUpdated: updatedDataFirebase.lastUpdated?.toDate ? updatedDataFirebase.lastUpdated.toDate().toISOString() : (updatedDataFirebase.lastUpdated ? new Date(updatedDataFirebase.lastUpdated).toISOString() : new Date().toISOString()),
          slaughterDate: updatedDataFirebase.slaughterDate?.toDate ? updatedDataFirebase.slaughterDate.toDate().toISOString() : (updatedDataFirebase.slaughterDate ? new Date(updatedDataFirebase.slaughterDate).toISOString() : undefined),
          submitterUsername,
         } as AdahiSubmission;
         await refreshData(); // Refresh data after constructing the result
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
    // console.log(`[AuthContext markAsSlaughtered] Attempting to mark submission ${submissionId} as slaughtered.`);
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
      if (!formattedPhoneNumber.startsWith("962")) { // Assuming Jordan country code
        formattedPhoneNumber = `962${formattedPhoneNumber}`;
      }
      
      const whatsappUrl = `https://wa.me/${formattedPhoneNumber}?text=${encodeURIComponent(message)}`;
      const smsUri = `sms:${formattedPhoneNumber}?body=${encodeURIComponent(message)}`;
      
      if (typeof window !== "undefined") {
        window.open(whatsappUrl, '_blank'); 
        // Attempt to open SMS app - user still needs to press send
        // This might not work on all devices/browsers or might only pre-fill the number
        setTimeout(() => { // Add a small delay for SMS link if WhatsApp takes over focus immediately
          window.open(smsUri, '_blank');
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
