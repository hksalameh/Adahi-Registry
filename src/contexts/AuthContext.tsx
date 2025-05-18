
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
        return {
          id: userDocSnap.id,
          email: userData.email || "",
          username: userData.username || "مستخدم",
          isAdmin: userData.isAdmin === true || userId === ADMIN_UID,
        } as AppUser;
      } else {
        if (userId === ADMIN_UID) {
          return {
            id: ADMIN_UID,
            email: "admin@example.com",
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
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }
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
      }

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
    } catch (error: any) {
      console.error("[AuthContext refreshData] Error refreshing data:", error);
      toast({ variant: "destructive", title: "خطأ", description: `فشل في تحديث البيانات: ${error.message}` });
    }
  }, [user, toast, fetchUserById]);

  useEffect(() => {
    let isMounted = true;
    if (!auth || !db) {
      if (isMounted) setLoading(false);
      return;
    }

    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!isMounted) return;
      console.log("[AuthContext onAuthStateChanged] Triggered. User UID:", firebaseUser ? firebaseUser.uid : 'null');
      try {
        if (firebaseUser) {
          let appUser = await fetchUserById(firebaseUser.uid);
          if (appUser) {
            const finalAppUser: AppUser = {
              ...appUser,
              isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
              username: (firebaseUser.uid === ADMIN_UID && !appUser.username) ? (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "Admin") : (appUser.username || "مستخدم"),
              email: firebaseUser.email || appUser.email,
            };
            if (isMounted) {
              setUser(finalAppUser);
              await refreshData(finalAppUser);
            }
          } else {
            if (firebaseUser.uid === ADMIN_UID) {
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
              if (isMounted) setUser(null);
            }
          }
        } else {
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
          console.log("[AuthContext onAuthStateChanged] Finally: setLoading(false)");
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeAuthStateChanged();
    };
  }, [fetchUserById, refreshData]);

  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز." });
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
        return null; // setLoading(false) will be handled in finally
      }
    } else {
      emailToLogin = identifier;
    }
    
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      const appUser = await fetchUserById(firebaseUser.uid);

      if (!appUser && firebaseUser.uid !== ADMIN_UID) {
        toast({ variant: "destructive", title: "خطأ في الحساب", description: "ملف تعريف المستخدم غير موجود في قاعدة البيانات." });
        await signOut(auth);
        return null; // setLoading(false) will be handled in finally
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
      
      // setUser(finalAppUser); // onAuthStateChanged will handle this
      // await refreshData(finalAppUser); // onAuthStateChanged will handle this
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
      return null;
    } finally {
        console.log("[AuthContext Login] Finally: setLoading(false)");
        setLoading(false);
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
    
    setLoading(true);
    try {
      const existingUserByUsername = await fetchUserByUsername(username);
      if (existingUserByUsername) {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم هذا موجود بالفعل. الرجاء اختيار اسم آخر." });
        return null; // setLoading(false) will be handled in finally
      }

      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length > 0) {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "هذا البريد الإلكتروني مسجل بالفعل." });
        return null; // setLoading(false) will be handled in finally
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
      // onAuthStateChanged will handle refreshData and setting user
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
      return null;
    } finally {
        console.log("[AuthContext Register] Finally: setLoading(false)");
        setLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      toast({ variant: "destructive", title: "خطأ", description: "نظام تسجيل الخروج غير مهيأ." });
      return;
    }
    setLoading(true);
    try {
      await signOut(auth);
      router.push("/auth/login");
      // onAuthStateChanged will handle setUser(null), submissions, and setLoading(false)
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج." });
    } finally {
      console.log("[AuthContext Logout] Finally: setLoading(false)");
      // Even if onAuthStateChanged handles it, ensuring it's false here is a safeguard
      // especially if router.push happens before onAuthStateChanged fully processes.
      setUser(null); // Explicitly clear user
      setSubmissions([]);
      setAllSubmissions([]);
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
