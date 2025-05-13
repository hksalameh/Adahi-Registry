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
        const isAdmin = userId === ADMIN_UID || userData.isAdmin === true;
        return { id: userDocSnap.id, ...userData, isAdmin } as AppUser;
      } else {
        if (userId === ADMIN_UID) {
            return {
                id: userId,
                email: "admin@example.com", 
                username: "Admin",
                isAdmin: true,
            };
        }
        console.log("No such user document for non-admin user!");
        return null;
      }
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return null;
    }
  };


  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setUser(null);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const appUser = await fetchUserById(firebaseUser.uid);
        if (appUser) {
            setUser({...appUser, email: firebaseUser.email || appUser.email});
        } else {
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
  }, []);

  useEffect(() => {
    if (!db) { 
        setSubmissions([]);
        setAllSubmissions([]);
        return;
    }
    
    // If user is null (login bypassed) and we want to show all submissions for adding,
    // this part might need adjustment or we rely on rules for security.
    // For now, if user is admin, they see all. If not admin (or user is null), they see their own (or none if user is null and query needs userId).
    // Given "لنلغي الان موضوع صفحة تسجيل الدخول", the non-admin query might not work as expected if 'user' is always null.
    // However, the immediate error is for *adding* submissions.

    let q;
    if (user && user.isAdmin) { // Admin sees all
      q = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
    } else if (user) { // Logged-in non-admin sees their own
      q = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
    } else { 
      // If user is null (login bypassed), what should be fetched for UserSubmissionsTable?
      // For now, let's assume it might fetch nothing or this part won't be active for viewing.
      // The primary concern is *adding* submissions.
      // To prevent errors, if 'user' is null, we might fetch no submissions or all if rules permit.
      // Let's set submissions to empty if no user.
      setSubmissions([]);
      // For admin, even if initial user state is null but then becomes admin, this effect will re-run.
      // If admin is not logged in (user is null), allSubmissions will also be empty or based on a public query.
      // Let's assume admin must be logged in to see allSubmissions.
      if (!user || !user.isAdmin) setAllSubmissions([]); // Clear admin submissions if not admin or no user
      return; // Don't set up listener if no user or not admin for specific queries
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
          submissionDateStr = new Date(0).toISOString(); 
        }
        
        return { 
          id: docSnapshot.id, 
          ...data, 
          submissionDate: submissionDateStr 
        } as AdahiSubmission;
      });

      if (user && user.isAdmin) {
        setAllSubmissions(subs);
        // setSubmissions([]); // Admin doesn't need 'submissions' for their own, they use allSubmissions
      } else {
        setSubmissions(subs);
      }
    }, (error) => {
      console.error("Error fetching submissions:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب البيانات." });
    });

    return () => unsubscribeSubmissions();
  }, [user, loading, toast, db]); // loading was included, db is a dependency


  const login = async (email: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
        toast({variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز."});
        return null;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      const appUser = await fetchUserById(firebaseUser.uid);
      
      if (appUser) {
        setUser({...appUser, email: firebaseUser.email || appUser.email});
        toast({title: "تم تسجيل الدخول بنجاح"});
        setLoading(false);
        return {...appUser, email: firebaseUser.email || appUser.email};
      }
      // Fallback if user doc not found immediately, create a minimal user object
      const minimalUser = {
        id: firebaseUser.uid, 
        email: firebaseUser.email || "", 
        username: firebaseUser.displayName || firebaseUser.email || "مستخدم", 
        isAdmin: firebaseUser.uid === ADMIN_UID 
      };
      setUser(minimalUser);
      toast({title: "تم تسجيل الدخول, جاري جلب بيانات المستخدم..."});
      setLoading(false);
      return minimalUser;

    } catch (error: any) {
      console.error("Login error:", error);
      setUser(null);
      setLoading(false);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage += "البيانات المدخلة غير صحيحة.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += "حدث خطأ ما.";
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
        email: firebaseUser.email || email,
        isAdmin: isAdmin, 
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);
      
      const appUser: AppUser = {
        id: firebaseUser.uid,
        ...newUserFirestoreData
      };

      setLoading(false);
      toast({title: "تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول."});
      // setUser(appUser); // No, onAuthStateChanged handles this. Or redirect to login.
      return appUser;
    } catch (error: any) {
      console.error("Registration error:", error);
      setUser(null); // Clear user on registration error
      setLoading(false);
      let errorMessage = "فشل التسجيل. ";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage += "البريد الإلكتروني مستخدم مسبقاً.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage += "كلمة المرور ضعيفة جداً.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage += "البريد الإلكتروني غير صالح.";
      } else {
        errorMessage += "حدث خطأ ما.";
      }
      toast({variant: "destructive", title: "خطأ في التسجيل", description: errorMessage});
      return null;
    }
  };

  const logout = async () => {
    if (!auth) {
        return;
    }
    try {
        await signOut(auth);
        setUser(null);
        setSubmissions([]);
        setAllSubmissions([]);
        toast({title: "تم تسجيل الخروج بنجاح"});
        router.push("/auth/login"); 
    } catch (error) {
        console.error("Logout error:", error);
        toast({variant: "destructive", title: "خطأ", description: "فشل تسجيل الخروج."});
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">): Promise<AdahiSubmission | null> => {
    if (!db) {
      console.error("AuthContext: Cannot add submission, DB not initialized.");
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن إضافة البيانات. النظام غير مهيأ بشكل صحيح." });
      return null;
    }
    // بما أن تسجيل الدخول تم إلغاؤه، يمكننا السماح بالإضافة بدون التحقق من المستخدم هنا
    // أو يمكنك وضع منطق مختلف إذا أردت تتبع المستخدم بطريقة أخرى (مثلاً، رقم فريد مؤقت)
    try {
      const newSubmissionData = {
        ...submissionData,
        userId: user ? user.id : "ANONYMOUS_USER", // قيمة افتراضية إذا كان المستخدم غير موجود
        userEmail: user ? user.email : "anonymous@example.com", // قيمة افتراضية
        submissionDate: serverTimestamp(),
        status: "pending" as const,
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
      
      // This client-side representation needs to be consistent.
      // serverTimestamp() will resolve to a server-side date.
      // For immediate feedback, use new Date().toISOString()
      const clientSideRepresentation: AdahiSubmission = {
        ...submissionData, // original data from form
        id: docRef.id,
        userId: newSubmissionData.userId, // use the potentially anonymous ID
        userEmail: newSubmissionData.userEmail, // use the potentially anonymous email
        status: "pending",
        submissionDate: new Date().toISOString() // For immediate UI update
      };
      return clientSideRepresentation;
    } catch (error) {
      console.error("Error adding submission:", error);
      // The error "Missing or insufficient permissions" will be caught here.
      // The toast message for this is handled in the form itself or a generic error here.
      if ((error as any)?.code === "permission-denied") {
           toast({ variant: "destructive", title: "خطأ في الصلاحيات", description: "ليس لديك الصلاحية لإضافة هذه البيانات. يرجى مراجعة قواعد الأمان في Firebase." });
      } else {
           toast({ variant: "destructive", title: "خطأ", description: "فشل في إضافة البيانات." });
      }
      return null;
    }
  };
  
  const updateSubmissionStatus = async (submissionId: string, status: 'pending' | 'entered'): Promise<boolean> => {
    if (!db) {
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث الحالة. النظام غير مهيأ." });
      return false;
    }
    if (!user || !user.isAdmin) { // Admin check remains
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لتحديث الحالة."});
        return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await updateDoc(submissionDocRef, { status });
      return true;
    } catch (error) {
      console.error("Error updating submission status:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في تحديث الحالة." });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate'>>): Promise<AdahiSubmission | null> => {
    if (!db) {
      toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث البيانات. النظام غير مهيأ." });
      return null;
    } 
    if (!user || !user.isAdmin) { // Admin check remains
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لتحديث البيانات."});
        return null;
    }
    
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      const updateData = { ...data, lastUpdated: serverTimestamp() }; // Example of adding a lastUpdated field
      await updateDoc(submissionDocRef, updateData);
      
      const updatedDocSnap = await getDoc(submissionDocRef);
      if (updatedDocSnap && updatedDocSnap.exists()) {
        const updatedData = updatedDocSnap.data();
        let submissionDateStr = updatedData.submissionDate;
        if (updatedData.submissionDate && typeof updatedData.submissionDate.toDate === 'function') {
          submissionDateStr = updatedData.submissionDate.toDate().toISOString();
        }
        // Ensure all fields of AdahiSubmission are present
        return { 
            id: updatedDocSnap.id, 
            ...updatedData, 
            submissionDate: submissionDateStr,
            // Ensure all required fields have defaults if not in updatedData
            donorName: updatedData.donorName || "",
            sacrificeFor: updatedData.sacrificeFor || "",
            phoneNumber: updatedData.phoneNumber || "",
            wantsToAttend: updatedData.wantsToAttend === true, // ensure boolean
            wantsFromSacrifice: updatedData.wantsFromSacrifice === true, // ensure boolean
            paymentConfirmed: updatedData.paymentConfirmed === true, // ensure boolean
            throughIntermediary: updatedData.throughIntermediary === true, // ensure boolean
            distributionPreference: updatedData.distributionPreference || "ramtha", // default if missing
            status: updatedData.status || "pending", // default if missing
         } as AdahiSubmission;
      }
      return null; 
    } catch (error) {
      console.error("Error updating submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في تحديث البيانات." });
      return null;
    }
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    if (!db) {
       toast({ variant: "destructive", title: "خطأ", description: "لا يمكن حذف البيانات. النظام غير مهيأ." });
      return false;
    } 
    if (!user || !user.isAdmin) { // Admin check remains
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لحذف البيانات."});
        return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await deleteDoc(submissionDocRef);
      return true;
    } catch (error) {
      console.error("Error deleting submission:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في حذف البيانات." });
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, submissions, addSubmission, updateSubmissionStatus, updateSubmission, deleteSubmission, allSubmissionsForAdmin: allSubmissions, fetchUserById }}>
      {children}
    </AuthContext.Provider>
  );
};
