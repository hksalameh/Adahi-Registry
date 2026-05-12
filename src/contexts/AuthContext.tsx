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

const ADMIN_UID = "kb8ltRhBOoaT5RXVYZAnW4vqtj03";

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
  markAsSlaughtered: (submissionId: string) => Promise<boolean>;
  sendSlaughterNotification: (submissionId: string, donorName: string, phoneNumber: string) => Promise<boolean>;
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
  }, []);

  const refreshData = useCallback(async (currentUserForRefresh?: AppUser | null) => {
    const effectiveUser = currentUserForRefresh || user;
    console.log("[AuthContext refreshData] Attempting to refresh data for effectiveUser:", JSON.stringify(effectiveUser));
    if (!db || !effectiveUser) {
      console.log("[AuthContext refreshData] DB not initialized or no effective user. Clearing submissions.");
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }

    console.log(`[AuthContext refreshData] User ID: ${effectiveUser.id}, Is Admin: ${effectiveUser.isAdmin}`);
    
    try {
      console.log("[AuthContext refreshData] Refreshing data for user ID:", effectiveUser.id, "isAdmin:", effectiveUser.isAdmin);
      if (effectiveUser.isAdmin) {
        const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
        const adminSnapshot = await getDocs(adminQuery);
        const adminSubsPromises = adminSnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          let submitterUsername: string | undefined = data.submitterUsername || data.userEmail;
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
  }, [user, toast, fetchUserById]);

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
      if (!isMounted) return;
      
      try {
        if (firebaseUser) {
          let appUser = await fetchUserById(firebaseUser.uid);
          if (appUser) {
            const finalAppUser: AppUser = {
              ...appUser,
              isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
              username: (firebaseUser.uid === ADMIN_UID && (!appUser.username || appUser.username === "admin@example.com" || appUser.username === "Admin")) ? "Admin" : (appUser.username || "مستخدم"),
              email: firebaseUser.email || appUser.email || (firebaseUser.uid === ADMIN_UID ? "admin@example.com" : ""),
            };
            if (isMounted) {
              setUser(finalAppUser);
              await refreshData(finalAppUser);
            }
          } else {
            if (isMounted) { setUser(null); setSubmissions([]); setAllSubmissions([]); }
          }
        } else {
          if (isMounted) { setUser(null); setSubmissions([]); setAllSubmissions([]); }
        }
      } catch (error) {
        if (isMounted) { setUser(null); setSubmissions([]); setAllSubmissions([]); }
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => { isMounted = false; unsubscribeAuthStateChanged(); };
  }, [fetchUserById]);

  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
      toast({ variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز." });
      setLoading(false);
      return null;
    }
    
    let emailToLogin = "";
    const isLoginByEmail = identifier.includes('@') && identifier.includes('.');

    if (!isLoginByEmail && identifier !== "Admin") {
      const userProfile = await fetchUserByUsername(identifier);
      if (userProfile && userProfile.email) {
        emailToLogin = userProfile.email;
      } else {
        toast({ variant: "destructive", title: "خطأ", description: "اسم المستخدم غير موجود." });
        setLoading(false);
        return null;
      }
    } else {
      emailToLogin = identifier === "Admin" ? (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com") : identifier;
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      let appUser = await fetchUserById(firebaseUser.uid);
      const finalAppUser: AppUser = appUser ? {
        ...appUser,
        isAdmin: firebaseUser.uid === ADMIN_UID || appUser.isAdmin,
        username: appUser.username || "مستخدم",
        email: firebaseUser.email || appUser.email || "",
      } : { 
        id: ADMIN_UID,
        email: firebaseUser.email || "admin@example.com",
        username: "Admin",
        isAdmin: true,
      };
      return finalAppUser; 
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في تسجيل الدخول", description: "يرجى التحقق من البيانات." });
      setLoading(false);
      return null;
    }
  };

  const register = async (username: string, email: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) return null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      const newUserFirestoreData = {
        username,
        email: firebaseUser.email || email,
        isAdmin: firebaseUser.uid === ADMIN_UID,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);
      toast({ title: "تم تسجيل المستخدم بنجاح!" });
      return { id: firebaseUser.uid, username, email, isAdmin: newUserFirestoreData.isAdmin } as AppUser;
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: error.message });
      setLoading(false);
      return null;
    }
  };

  const logout = async () => {
    if (auth) await signOut(auth);
  };

  const addSubmission = async (submissionData: any): Promise<AdahiSubmission | null> => {
    if (!db || !user) return null;
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
      return { ...newSubmissionData, id: docRef.id, submissionDate: new Date().toISOString() } as AdahiSubmission;
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
      return null;
    }
  };

  const updateSubmissionStatus = async (submissionId: string, newStatus: 'pending' | 'entered'): Promise<boolean> => {
    if (!db || !user || !user.isAdmin) return false;
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, {
        status: newStatus,
        lastUpdated: serverTimestamp(),
      });
      await refreshData(); 
      return true;
    } catch (error: any) {
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: any): Promise<AdahiSubmission | null> => {
    if (!db || !user || !user.isAdmin) return null;
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, { ...data, lastUpdated: serverTimestamp() });
      await refreshData(); 
      return { id: submissionId, ...data } as AdahiSubmission;
    } catch (error: any) {
      return null;
    }
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    if (!db || !user || !user.isAdmin) return false;
    try {
      await deleteDoc(doc(db, "submissions", submissionId));
      await refreshData(); 
      return true;
    } catch (error: any) {
      return false;
    }
  };
  
  const fetchUserByUsername = useCallback(async (username: string): Promise<AppUser | null> => {
    if (!db) return null;
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      return { id: userDoc.id, email: userData.email, username: userData.username, isAdmin: userData.isAdmin === true || userDoc.id === ADMIN_UID } as AppUser;
    } catch (error) {
      return null;
    }
  }, []);

 const markAsSlaughtered = async (submissionId: string): Promise<boolean> => {
    if (!db || !user || !user.isAdmin) return false;
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, {
        isSlaughtered: true,
        slaughterDate: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });
      await refreshData();
      return true;
    } catch (error: any) {
      return false;
    }
  };

  // --- الدالة المطلوبة المعدلة بمنطق "الخيار ثم التأخير ثم التأكيد" ---
  const sendSlaughterNotification = async (submissionId: string, donorName: string, phoneNumber: string): Promise<boolean> => {
    if (!db || !user || !user.isAdmin) {
      toast({ variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لإرسال الإشعارات." });
      return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      const message = `السيد/السيدة ${donorName} تقبل الله طاعتكم وكل عام وانتم بالف خير تم ذبح اضحيتك ربنا يتقبل منكم`;
      
      let formattedPhoneNumber = phoneNumber.startsWith("0") ? phoneNumber.substring(1) : phoneNumber;
      if (!formattedPhoneNumber.startsWith("962")) {
        formattedPhoneNumber = `962${formattedPhoneNumber}`;
      }
      
      const whatsappUrl = `https://wa.me/${formattedPhoneNumber}?text=${encodeURIComponent(message)}`;
      const isIphone = typeof navigator !== "undefined" && /iPhone/i.test(navigator.userAgent);
      const smsUri = `sms:+${formattedPhoneNumber}${isIphone ? '&' : '?'}body=${encodeURIComponent(message)}`;
      
      if (typeof window !== "undefined") {
        // 1. اختيار وسيلة الإرسال في نافذة منبثقة
        const sendViaWhatsApp = confirm("اختيار وسيلة الإرسال:\n\n(موافق = واتساب | إلغاء = رسالة نصية SMS)");

        if (sendViaWhatsApp) {
          window.open(whatsappUrl, '_blank');
        } else {
          window.location.href = smsUri;
        }

        // 2. سؤال التأكيد بعد تأخير 1.5 ثانية لضمان ظهور السؤال بعد محاولة فتح التطبيق
        setTimeout(async () => {
          const isSent = confirm("هل قمت بإرسال الرسالة بنجاح؟\n\n(اضغط موافق فقط إذا تأكدت من الإرسال لتغيير حالة الأضحية إلى 'تم وأُشعر')");

          if (isSent) {
            await updateDoc(submissionDocRef, {
              slaughterStatus: 'notified',
              lastUpdated: serverTimestamp(),
            });
            toast({ title: "تم التحديث بنجاح", description: "تغيرت الحالة إلى 'تم وأُشعر'" });
            await refreshData();
          } else {
            toast({ title: "تنبيه", description: "لم يتم تغيير حالة الأضحية، يمكنك المحاولة لاحقاً." });
          }
        }, 1500);

        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Error sending notification:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في محاولة الإرسال." });
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
      markAsSlaughtered,
      sendSlaughterNotification
    }}>
      {children}
    </AuthContext.Provider>
  );
};
