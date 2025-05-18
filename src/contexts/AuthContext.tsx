
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

const ADMIN_UID = "vqhrldpAdeWGcCgcMpWWRGdslOS2"; // UID الخاص بالمدير

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
        return {
          id: userDocSnap.id,
          email: userData.email || "",
          username: userData.username || "مستخدم",
          isAdmin: userData.isAdmin === true || userId === ADMIN_UID,
        } as AppUser;
      } else {
        if (userId === ADMIN_UID) { // Handle case where Admin might not have a doc initially
          return {
            id: ADMIN_UID,
            email: "admin@example.com", // Fallback email for admin if not in DB
            username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin",
            isAdmin: true,
          };
        }
        console.warn(`[AuthContext fetchUserById] User document not found for ID: ${userId}`);
        return null;
      }
    } catch (error) {
      console.error("[AuthContext fetchUserById] Error fetching user by ID:", error);
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
    if (!db || !effectiveUser) {
      console.log("[AuthContext refreshData] DB not initialized or no effective user. Clearing submissions.");
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }
    // console.log(`[AuthContext refreshData] Starting data refresh for user ID: ${effectiveUser.id}, isAdmin: ${effectiveUser.isAdmin}`);
    try {
      if (effectiveUser.isAdmin) {
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
        // console.log(`[AuthContext refreshData] Admin submissions fetched:`, resolvedAdminSubs.length);
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
      // console.log("[AuthContext refreshData - User] User submissions fetched for", effectiveUser.id, ":", userSubs.length);
      setSubmissions(userSubs);

    } catch (error: any) {
        console.error("[AuthContext refreshData] Error refreshing data:", error);
        toast({variant: "destructive", title: "خطأ", description: `فشل في تحديث البيانات: ${error.message}`});
    }
  }, [user, toast, fetchUserById]);


  useEffect(() => {
    console.log("[AuthContext useEffect] Mounting. Checking Firebase services.");
    if (!auth || !db) {
      console.error("[AuthContext useEffect] Firebase services (auth or db) not available. Setting loading to false.");
      setLoading(false);
      setUser(null);
      return;
    }
    
    let isMounted = true;
    console.log("[AuthContext useEffect] Firebase services available. Subscribing to onAuthStateChanged.");

    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!isMounted) {
        console.log("[AuthContext onAuthStateChanged] Not mounted, returning.");
        return;
      }

      console.log("[AuthContext onAuthStateChanged] Triggered. FirebaseUser:", firebaseUser ? firebaseUser.uid : null);
      // setLoading(true); // No need, initial state is true, and we set it to false in finally

      try {
        if (firebaseUser) {
          console.log("[AuthContext onAuthStateChanged] Firebase user found. Fetching app user...");
          let appUser = await fetchUserById(firebaseUser.uid);
          
          if (appUser) {
              const finalAppUser: AppUser = {
                  ...appUser,
                  isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
                  username: (firebaseUser.uid === ADMIN_UID && !appUser.username) ? (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin") : (appUser.username || "مستخدم"),
                  email: firebaseUser.email || appUser.email, 
              };
              if (isMounted) {
                console.log("[AuthContext onAuthStateChanged] App user found/constructed:", finalAppUser);
                setUser(finalAppUser);
                await refreshData(finalAppUser); 
              }
          } else {
              // Handle case where Firestore user doc doesn't exist
              if (firebaseUser.uid === ADMIN_UID) {
                  console.log("[AuthContext onAuthStateChanged] Admin UID detected, but no Firestore doc. Creating admin user object.");
                  const adminAppUser: AppUser = {
                      id: ADMIN_UID,
                      email: firebaseUser.email || "admin@example.com", 
                      username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin",
                      isAdmin: true,
                  };
                  if (isMounted) {
                      setUser(adminAppUser);
                      await refreshData(adminAppUser);
                  }
              } else {
                  console.warn(`[AuthContext onAuthStateChanged] No app user found for Firebase UID: ${firebaseUser.uid}. Setting user to null.`);
                  if (isMounted) setUser(null);
              }
          }
        } else { // No firebaseUser
          console.log("[AuthContext onAuthStateChanged] No Firebase user. Setting user to null and clearing submissions.");
          if (isMounted) {
            setUser(null);
            setSubmissions([]); 
            setAllSubmissions([]); 
          }
        }
      } catch (error) {
        console.error("[AuthContext onAuthStateChanged] Error during auth state processing:", error);
        if (isMounted) setUser(null); // Reset user on error
      } finally {
        if (isMounted) {
          console.log("[AuthContext onAuthStateChanged] Auth state processing complete. Setting loading to false.");
          setLoading(false);
        }
      }
    });

    return () => {
      console.log("[AuthContext useEffect] Unmounting. Unsubscribing from onAuthStateChanged.");
      isMounted = false;
      unsubscribeAuthStateChanged();
    };
  }, [fetchUserById, refreshData]);


  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز." });
      return null;
    }
    setLoading(true); // Set loading true at the start of login attempt

    let emailToLogin = "";
    const isAdminLoginAttempt = identifier === (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin");
    const isLoginByEmail = identifier.includes('@') && identifier.includes('.');
    
    console.log(`[AuthContext Login] Attempting login with identifier: ${identifier}. isAdminLoginAttempt: ${isAdminLoginAttempt}, isLoginByEmail: ${isLoginByEmail}`);

    if (isAdminLoginAttempt && process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        emailToLogin = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        console.log(`[AuthContext Login] Admin login attempt, using admin email: ${emailToLogin}`);
    } else if (!isLoginByEmail) {
        console.log(`[AuthContext Login] Login by username: ${identifier}. Fetching user profile...`);
        const userProfile = await fetchUserByUsername(identifier);
        if (userProfile && userProfile.email) {
            emailToLogin = userProfile.email;
            console.log(`[AuthContext Login] Username found. Corresponding email: ${emailToLogin}`);
        } else {
            console.warn(`[AuthContext Login] Username '${identifier}' not found or no email associated.`);
            toast({
                variant: "destructive",
                title: "خطأ في تسجيل الدخول",
                description: "اسم المستخدم غير موجود أو لم يتم العثور على بريد إلكتروني مطابق. يرجى مراعاة حالة الأحرف.",
            });
            setLoading(false);
            return null;
        }
    } else {
      emailToLogin = identifier; // It's an email
      console.log(`[AuthContext Login] Login by email: ${emailToLogin}`);
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      console.log(`[AuthContext Login] Firebase signInWithEmailAndPassword successful for UID: ${firebaseUser.uid}`);
      
      // onAuthStateChanged will set user and loading state, but that might take time.
      // For immediate return and to ensure loading is false after login logic completes:
      const appUser = await fetchUserById(firebaseUser.uid); 

      if (!appUser && firebaseUser.uid !== ADMIN_UID) {
          console.warn(`[AuthContext Login] Firestore user doc not found for UID: ${firebaseUser.uid} and not admin.`);
          toast({ variant: "destructive", title: "خطأ في الحساب", description: "ملف تعريف المستخدم غير موجود في قاعدة البيانات." });
          await signOut(auth); // Sign out if app user profile is missing for non-admin
          setLoading(false);
          return null;
      }
      
      const finalAppUser: AppUser = appUser ? {
          ...appUser,
          isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
          username: (firebaseUser.uid === ADMIN_UID && !appUser.username) ? (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin") : (appUser.username || "مستخدم"),
          email: firebaseUser.email || appUser.email,
      } : { 
          id: ADMIN_UID,
          email: emailToLogin, 
          username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin",
          isAdmin: true,
      };
      
      // console.log(`[AuthContext Login] Login successful. Firebase UID: ${firebaseUser.uid}, ADMIN_UID: ${ADMIN_UID}. Determined isAdmin: ${finalAppUser.isAdmin}`);
      // If onAuthStateChanged is robust, we might not need to call setUser and refreshData here
      // but for faster UI update and ensuring loading state is managed:
      setUser(finalAppUser); // Update user state immediately
      await refreshData(finalAppUser); // Refresh data for the newly logged-in user
      setLoading(false); // Set loading false after successful login and data refresh
      return finalAppUser;

    } catch (error: any) {
      console.error("[AuthContext Login] Login error:", error);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        errorMessage = "البيانات المدخلة غير صحيحة. يرجى التحقق من اسم المستخدم/البريد الإلكتروني وكلمة المرور.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += "الرجاء التحقق من بيانات الاعتماد أو الاتصال بالمسؤول.";
      }
      toast({ variant: "destructive", title: "خطأ في تسجيل الدخول", description: errorMessage });
      setLoading(false); // Set loading false on login failure
      return null;
    }
  };


  const register = async (username: string, email: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام التسجيل غير جاهز." });
      return null;
    }
    setLoading(true);

    const arabicUsernameRegex = /^[\u0600-\u06FF\s\u0660-\u0669a-zA-Z0-9_.-]{3,}$/;
    if (!arabicUsernameRegex.test(username)) {
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل ويمكن أن يحتوي على حروف عربية، إنجليزية، أرقام، والرموز (- . _).", duration: 7000 });
      setLoading(false);
      return null;
    }

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
    } catch (error: any) {
       console.error("[AuthContext Register] Error checking username/email existence:", error);
       let checkErrorMsg = "حدث خطأ أثناء التحقق من توفر اسم المستخدم/البريد الإلكتروني.";
       if (error.code === 'auth/invalid-email') {
         checkErrorMsg = "البريد الإلكتروني المدخل غير صالح.";
       }
       toast({ variant: "destructive", title: "خطأ في التسجيل", description: checkErrorMsg });
       setLoading(false);
       return null;
    }
    
    try {
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
      // onAuthStateChanged will handle refreshData and setting user
      setLoading(false);
      return appUser; 
    } catch (error: any) {
      console.error("[AuthContext Register] Error creating user:", error);
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
  };


  const logout = async () => {
    if (!auth) {
        toast({variant: "destructive", title: "خطأ", description: "نظام تسجيل الخروج غير مهيأ."});
        return;
    }
    setLoading(true);
    try {
        await signOut(auth);
        // onAuthStateChanged will handle setUser(null) and setLoading(false)
        // Forcing redirect here:
        router.push("/auth/login");
    } catch (error: any) {
        toast({variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج."});
        setLoading(false); // Ensure loading is false on logout error
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
        slaughterDate: null,
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
      
      await refreshData(); 

      const clientSideRepresentation: AdahiSubmission = {
        ...submissionData,
        id: docRef.id,
        userId: newSubmissionData.userId,
        userEmail: newSubmissionData.userEmail,
        status: "pending",
        submissionDate: new Date().toISOString(), // Approximate, serverTimestamp is better
        lastUpdated: new Date().toISOString(),   // Approximate
        lastUpdatedBy: newSubmissionData.lastUpdatedBy,
        lastUpdatedByEmail: newSubmissionData.lastUpdatedByEmail,
        submitterUsername: user.username,
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
          submissionDate: updatedDataFirebase.submissionDate?.toDate ? updatedDataFirebase.submissionDate.toDate().toISOString() : (updatedDataFirebase.submissionDate ? new Date(updatedDataFirebase.submissionDate).toISOString() : new Date().toISOString()),
          lastUpdated: updatedDataFirebase.lastUpdated?.toDate ? updatedDataFirebase.lastUpdated.toDate().toISOString() : (updatedDataFirebase.lastUpdated ? new Date(updatedDataFirebase.lastUpdated).toISOString() : new Date().toISOString()),
          slaughterDate: updatedDataFirebase.slaughterDate?.toDate ? updatedDataFirebase.slaughterDate.toDate().toISOString() : (updatedDataFirebase.slaughterDate ? new Date(updatedDataFirebase.slaughterDate).toISOString() : undefined),
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

    