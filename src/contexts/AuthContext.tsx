
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
          isAdmin: userData.isAdmin === true || userId === ADMIN_UID,
        } as AppUser;
      } else {
         if (userId === ADMIN_UID) {
          // Admin user special handling if not in DB (should exist though)
          return {
            id: ADMIN_UID,
            email: process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com",
            username: "Admin",
            isAdmin: true,
          };
        }
        // console.warn(`User document with UID ${userId} not found in Firestore.`);
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

      if (typeof userData.email !== 'string' || typeof userData.username !== 'string') {
        console.error(`User document ${userDoc.id} has missing or invalid email/username fields.`);
        return null;
      }

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
      console.warn("Auth or DB service not available. Check Firebase configuration.");
      setLoading(false);
      setUser(null);
      return;
    }

    enableNetwork(db)
      .then(() => console.log("Firestore network enabled."))
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
            // This can happen if a user is authenticated in Firebase Auth but their doc was deleted from Firestore
            console.warn(`User with UID ${firebaseUser.uid} authenticated but no Firestore document found. Logging out.`);
            await signOut(auth); // Log them out to avoid inconsistent state
            setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuthStateChanged();
      // Consider terminating Firestore if it's safe to do so on component unmount,
      // though usually not needed for AuthProvider which lives for the app lifetime.
      // if (db) {
      //   terminate(db).catch(err => console.error("Error terminating Firestore:", err));
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
      unsubscribeAdminSubmissions = onSnapshot(adminQuery, async (querySnapshot) => {
        const subsPromises = querySnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          let submitterUsername: string | undefined = data.userEmail; // Fallback to email

          if (data.userId) {
            const submitterProfile = await fetchUserById(data.userId);
            if (submitterProfile && submitterProfile.username) {
              submitterUsername = submitterProfile.username;
            }
          }

          return {
            id: docSnapshot.id,
            ...data,
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString(): new Date().toISOString()),
            submitterUsername, // Add the fetched username
          } as AdahiSubmission;
        });

        const resolvedSubs = await Promise.all(subsPromises);
        setAllSubmissions(resolvedSubs);

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
  }, [db, user, toast, fetchUserById]);


  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز." });
      return null;
    }
    setLoading(true);

    let emailToLogin = identifier;

    // If identifier is admin's UID, fetch their email
    if (identifier === ADMIN_UID) {
        const adminProfile = await fetchUserById(ADMIN_UID);
        if (adminProfile && adminProfile.email) {
            emailToLogin = adminProfile.email;
        } else {
            toast({
                variant: "destructive",
                title: "خطأ في تسجيل دخول المدير",
                description: "لم يتم العثور على البريد الإلكتروني للمدير.",
            });
            setLoading(false);
            return null;
        }
    } else if (!identifier.includes('@') || !identifier.includes('.')) {
      // If not admin UID and not an email, assume it's a username
      const userProfile = await fetchUserByUsername(identifier);
      if (userProfile && userProfile.email) {
        emailToLogin = userProfile.email;
      } else {
        toast({
          variant: "destructive",
          title: "خطأ في تسجيل الدخول",
          description: "اسم المستخدم غير موجود أو لم يتم العثور على بريد إلكتروني مطابق. يرجى مراعاة حالة الأحرف.",
        });
        setLoading(false);
        return null;
      }
    }
    // If identifier is already an email, emailToLogin remains as is.

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      const appUser = await fetchUserById(firebaseUser.uid); // This will also correctly identify admin by UID

      if (!appUser) {
        console.error(`User ${firebaseUser.uid} authenticated but no Firestore document found.`);
        if (firebaseUser.uid === ADMIN_UID) {
          const minimalAdminUser: AppUser = {
            id: ADMIN_UID,
            email: emailToLogin, // Use the email determined for login
            username: "Admin",
            isAdmin: true,
          };
          toast({ variant: "warning", title: "تنبيه", description: "ملف تعريف المدير غير كامل في قاعدة البيانات ولكن تم تسجيل الدخول." });
          setLoading(false);
          return minimalAdminUser;
        }
        toast({ variant: "destructive", title: "خطأ في الحساب", description: "ملف تعريف المستخدم غير موجود في قاعدة البيانات." });
        await signOut(auth);
        setLoading(false);
        return null;
      }

      // Ensure admin status is correctly set if it's the admin UID
      if (appUser.id === ADMIN_UID && !appUser.isAdmin) {
        appUser.isAdmin = true;
      }

      setLoading(false);
      return appUser;

    } catch (error: any) {
      console.error("Login error in AuthContext:", error);
      setLoading(false);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        errorMessage += "البيانات المدخلة غير صحيحة.";
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
      console.error("Error checking email existence:", error);
      if (error.code !== 'auth/invalid-email') {
        toast({ variant: "destructive", title: "خطأ في التسجيل", description: "حدث خطأ أثناء التحقق من البريد الإلكتروني." });
      }
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
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);

      const appUser: AppUser = {
        id: firebaseUser.uid,
        username: newUserFirestoreData.username,
        email: newUserFirestoreData.email,
        isAdmin: newUserFirestoreData.isAdmin,
      };

      setLoading(false);
      toast({ title: "تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول." });
      return appUser;
    } catch (error: any) {
      console.error("Registration error:", error);
      setLoading(false);
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
        await signOut(auth);
        //setUser(null); // Handled by onAuthStateChanged
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
      if (user.isAdmin && user.id === ADMIN_UID) {
        const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
        const adminSnapshot = await getDocs(adminQuery);
        const adminSubsPromises = adminSnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          let submitterUsername: string | undefined = data.userEmail;
           if (data.userId) {
            const submitterProfile = await fetchUserById(data.userId);
            if (submitterProfile && submitterProfile.username) {
              submitterUsername = submitterProfile.username;
            }
          }
          return {
            id: docSnapshot.id, ...data,
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : new Date(data.submissionDate).toISOString(),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : new Date(data.lastUpdated).toISOString(),
            submitterUsername,
          } as AdahiSubmission;
        });
        const resolvedAdminSubs = await Promise.all(adminSubsPromises);
        setAllSubmissions(resolvedAdminSubs);
      }

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
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
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
        submitterUsername: user.username, // Add current user's username
      };
      // onSnapshot should update the local state, but for immediate UI feedback, you might manually update
      // or rely on refreshData which will be called by other actions.
      // For simplicity, let onSnapshot handle it. If lag is an issue, add optimistic updates.
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
      // onSnapshot will handle the update.
      return true;
    } catch (error: any) {
      console.error("Error updating submission status:", error);
      toast({ variant: "destructive", title: "خطأ في تحديث الحالة", description: `فشل في تحديث الحالة: ${error.message}` });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail' | 'submitterUsername'>>): Promise<AdahiSubmission | null> => {
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
        let submitterUsername: string | undefined = updatedDataFirebase.userEmail;
        if (updatedDataFirebase.userId) {
          const submitterProfile = await fetchUserById(updatedDataFirebase.userId);
          if (submitterProfile && submitterProfile.username) {
            submitterUsername = submitterProfile.username;
          }
        }

        const result = {
          id: updatedDocSnap.id,
          ...(updatedDataFirebase as Omit<AdahiSubmission, 'id' | 'submissionDate' | 'lastUpdated' | 'submitterUsername'>),
          submissionDate: updatedDataFirebase.submissionDate?.toDate ? updatedDataFirebase.submissionDate.toDate().toISOString() : new Date(updatedDataFirebase.submissionDate).toISOString(),
          lastUpdated: updatedDataFirebase.lastUpdated?.toDate ? updatedDataFirebase.lastUpdated.toDate().toISOString() : new Date(updatedDataFirebase.lastUpdated).toISOString(),
          submitterUsername,
         } as AdahiSubmission;
         // onSnapshot will handle the update.
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
      // onSnapshot will handle the update.
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

