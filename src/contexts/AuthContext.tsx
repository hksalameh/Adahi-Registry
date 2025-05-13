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
  terminate, // Added terminate
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<AppUser | null>; // Adjusted based on previous changes
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>;
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated'>>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[];
  fetchUserById: (userId: string) => Promise<AppUser | null>;
  fetchUserByUsername: (username: string) => Promise<AppUser | null>;
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
      console.error("AuthContext: Firestore DB is not initialized for fetchUserById.");
      return null;
    }
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const isAdminUser = userId === ADMIN_UID || userData.isAdmin === true;
        return { 
          id: userDocSnap.id, 
          ...userData, 
          email: userData.email || "", 
          username: userData.username || "مستخدم", // Ensure username has a fallback
          isAdmin: isAdminUser 
        } as AppUser;
      } else {
        if (userId === ADMIN_UID) { 
            return {
                id: userId,
                email: "admin@example.com", // Placeholder, should be fetched if admin doc exists
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
  };

  const fetchUserByUsername = async (username: string): Promise<AppUser | null> => {
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
      const isAdminUser = userDoc.id === ADMIN_UID || userData.isAdmin === true;
      return { 
        id: userDoc.id, 
        ...userData, 
        email: userData.email || "", 
        username: userData.username || "مستخدم", // Ensure username has a fallback
        isAdmin: isAdminUser 
      } as AppUser;

    } catch (error) {
      console.error("Error fetching user by username:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب بيانات المستخدم." });
      return null;
    }
  };


  useEffect(() => {
    if (!auth || !db) {
      console.warn("Auth or DB service not available for onAuthStateChanged or Firestore listeners.");
      setLoading(false);
      setUser(null);
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }

    enableNetwork(db).catch(err => console.error("Error enabling network for Firestore:", err));

    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true); // Set loading true while fetching user data
      if (firebaseUser) {
        const appUser = await fetchUserById(firebaseUser.uid);
        if (appUser) {
            setUser({...appUser, email: firebaseUser.email || appUser.email, username: appUser.username || firebaseUser.displayName || firebaseUser.email || "مستخدم"}); 
        } else {
            setUser({ 
                id: firebaseUser.uid,
                email: firebaseUser.email || "",
                username: firebaseUser.displayName || firebaseUser.email || "مستخدم", // Default username
                isAdmin: firebaseUser.uid === ADMIN_UID, 
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    let unsubscribeUserSubmissions: () => void = () => {};
    let unsubscribeAdminSubmissions: () => void = () => {};

    if (user) { 
        if (user.isAdmin) {
          const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
          unsubscribeAdminSubmissions = onSnapshot(adminQuery, (querySnapshot) => {
            const subs = querySnapshot.docs.map(docSnapshot => {
              const data = docSnapshot.data();
              return { 
                id: docSnapshot.id, 
                ...data, 
                submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : new Date(data.submissionDate).toISOString(),
                lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : new Date(data.lastUpdated).toISOString(),
              } as AdahiSubmission;
            });
            setAllSubmissions(subs);
          }, (error) => {
            console.error("Error fetching admin submissions:", error);
             if (error.message.includes("offline")) {
               toast({ variant: "destructive", title: "غير متصل", description: "لا يمكن جلب بيانات المدير لأنك غير متصل بالإنترنت." });
            } else {
              toast({ variant: "destructive", title: "خطأ في جلب بيانات المدير", description: `فشل في جلب الأضاحي: ${error.message}` });
            }
          });
        } else { 
          const userQuery = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
          unsubscribeUserSubmissions = onSnapshot(userQuery, (querySnapshot) => {
            const subs = querySnapshot.docs.map(docSnapshot => {
              const data = docSnapshot.data();
              return { 
                id: docSnapshot.id, 
                ...data, 
                submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : new Date(data.submissionDate).toISOString(),
                lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : new Date(data.lastUpdated).toISOString(),
              } as AdahiSubmission;
            });
            setSubmissions(subs);
          }, (error) => {
            console.error("Error fetching user submissions:", error);
            if (error.code === 'failed-precondition' && error.message.includes('requires an index')) {
               toast({ variant: "destructive", title: "خطأ في قاعدة البيانات", description: "يتطلب الاستعلام فهرسًا. يرجى مراجعة Firebase Console لإنشاء الفهرس المطلوب." });
            } else if (error.message.includes("offline")) {
               toast({ variant: "destructive", title: "غير متصل", description: "لا يمكن جلب البيانات لأنك غير متصل بالإنترنت." });
            } else {
              toast({ variant: "destructive", title: "خطأ في جلب البيانات", description: `فشل في جلب الأضاحي: ${error.message}` });
            }
          });
        }
    } else if (user === null && !loading) { 
        setSubmissions([]);
        setAllSubmissions([]);
    }

    return () => {
        unsubscribeAuthStateChanged();
        if (unsubscribeUserSubmissions) unsubscribeUserSubmissions();
        if (unsubscribeAdminSubmissions) unsubscribeAdminSubmissions();
        
        if (db) {
            terminate(db)
              .then(() => console.log("Firestore instance terminated on AuthContext unmount/re-run."))
              .catch(error => console.error("Error terminating Firestore on AuthContext unmount/re-run:", error));
        }
    };
  }, [user, loading, auth, db, toast]);


  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
        toast({variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز."});
        return null;
    }
    setLoading(true);
    let emailToLogin = "";
    let userToAuth = null;

    if (identifier === "admin@example.com") { // Admin specific login
        emailToLogin = identifier;
    } else { // Regular user login by username
        userToAuth = await fetchUserByUsername(identifier);
        if (userToAuth && userToAuth.email) {
            emailToLogin = userToAuth.email;
        } else {
            toast({
              variant: "destructive",
              title: "خطأ في تسجيل الدخول",
              description: "اسم المستخدم غير موجود أو لم يتم العثور على بريد إلكتروني مطابق.",
            });
            setLoading(false);
            return null;
        }
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, pass);
      const firebaseUser = userCredential.user;
      
      // Use fetched userToAuth if available (for non-admin username login), otherwise fetch by ID
      const appUser = userToAuth && !userToAuth.isAdmin ? userToAuth : await fetchUserById(firebaseUser.uid); 
      
      if (appUser) {
        setLoading(false);
        return {...appUser, email: firebaseUser.email || appUser.email, username: appUser.username || firebaseUser.displayName || "مستخدم" };
      }
      
      const minimalUser: AppUser = {
        id: firebaseUser.uid, 
        email: firebaseUser.email || "", 
        username: firebaseUser.displayName || firebaseUser.email || "مستخدم", 
        isAdmin: firebaseUser.uid === ADMIN_UID 
      };
      setLoading(false);
      return minimalUser;

    } catch (error: any) {
      console.error("Login error:", error);
      setLoading(false);
      let errorMessage = "فشل تسجيل الدخول. ";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        errorMessage += "البيانات المدخلة غير صحيحة.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "مشكلة في الاتصال بالشبكة.";
      } else {
        errorMessage += error.message || "حدث خطأ ما.";
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
    
    const existingUserByUsername = await fetchUserByUsername(username);
    if (existingUserByUsername) {
        toast({variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم هذا موجود بالفعل. الرجاء اختيار اسم آخر."});
        return null;
    }

    // Check if email is already in use by querying Firestore (Firebase Auth handles this too, but good for UX)
    const usersRef = collection(db, "users");
    const emailQuery = query(usersRef, where("email", "==", email));
    const emailQuerySnapshot = await getDocs(emailQuery);
    if (!emailQuerySnapshot.empty) {
        toast({variant: "destructive", title: "خطأ في التسجيل", description: "البريد الإلكتروني مستخدم مسبقاً."});
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
      };
      await setDoc(doc(db, "users", firebaseUser.uid), newUserFirestoreData);
      
      const appUser: AppUser = {
        id: firebaseUser.uid,
        ...newUserFirestoreData
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
        errorMessage += "كلمة المرور ضعيفة جداً.";
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
        // setUser(null); // onAuthStateChanged will handle this
        // setSubmissions([]);
        // setAllSubmissions([]);
        toast({title: "تم تسجيل الخروج بنجاح"});
        router.push("/auth/login"); 
    } catch (error: any) {
        console.error("Logout error:", error);
        toast({variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج."});
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">): Promise<AdahiSubmission | null> => {
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
      };
      // Data will be updated via onSnapshot, no need to manually update local state here.
      return clientSideRepresentation;
    } catch (error: any) {
      console.error("Error adding submission:", error);
      let specificMessage = "فشل في إضافة البيانات.";
      if (error.code === 'permission-denied') {
        specificMessage = "فشل في إضافة البيانات: ليس لديك الصلاحيات اللازمة.";
      } else if (error.message) {
        specificMessage = `فشل في إضافة البيانات: ${error.message}`;
      }
      toast({ variant: "destructive", title: "خطأ", description: specificMessage });
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
      await updateDoc(submissionDocRef, { status, lastUpdated: serverTimestamp() });
      // onDataChange in AdminSubmissionsTable is called, which relies on onSnapshot updating state.
      return true;
    } catch (error: any) {
      console.error("Error updating submission status:", error);
      let specificMessage = "فشل في تحديث الحالة.";
      if (error.code === 'permission-denied') {
        specificMessage = "فشل في تحديث الحالة: ليس لديك الصلاحيات اللازمة.";
      } else if (error.message) {
        specificMessage = `فشل في تحديث الحالة: ${error.message}`;
      }
      toast({ variant: "destructive", title: "خطأ في تحديث الحالة", description: specificMessage });
      return false;
    }
  };

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated'>>): Promise<AdahiSubmission | null> => {
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
      const updateData = { ...data, lastUpdated: serverTimestamp() };
      await updateDoc(submissionDocRef, updateData);
      
      // Return the representation of the updated doc for immediate use if needed,
      // though onSnapshot should handle UI updates.
      const updatedDocSnap = await getDoc(submissionDocRef);
      if (updatedDocSnap.exists()) {
        const updatedDataFirebase = updatedDocSnap.data();
        return { 
          id: updatedDocSnap.id, 
          ...(updatedDataFirebase as Omit<AdahiSubmission, 'id' | 'submissionDate' | 'lastUpdated'>),
          submissionDate: updatedDataFirebase.submissionDate?.toDate ? updatedDataFirebase.submissionDate.toDate().toISOString() : new Date(updatedDataFirebase.submissionDate).toISOString(),
          lastUpdated: updatedDataFirebase.lastUpdated?.toDate ? updatedDataFirebase.lastUpdated.toDate().toISOString() : new Date(updatedDataFirebase.lastUpdated).toISOString(), 
         } as AdahiSubmission;
      }
      return null; 
    } catch (error: any) {
      console.error("Error updating submission:", error);
      let specificMessage = "فشل في تحديث البيانات.";
      if (error.code === 'permission-denied') {
        specificMessage = "فشل في تحديث البيانات: ليس لديك الصلاحيات اللازمة.";
      } else if (error.message) {
        specificMessage = `فشل في تحديث البيانات: ${error.message}`;
      }
      toast({ variant: "destructive", title: "خطأ في تحديث البيانات", description: specificMessage });
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
      return true;
    } catch (error: any) {
      console.error("Error deleting submission:", error);
      let specificMessage = "فشل في حذف البيانات.";
      if (error.code === 'permission-denied') {
        specificMessage = "فشل في حذف البيانات: ليس لديك الصلاحيات اللازمة.";
      } else if (error.message) {
        specificMessage = `فشل في حذف البيانات: ${error.message}`;
      }
      toast({ variant: "destructive", title: "خطأ في حذف البيانات", description: specificMessage });
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
        fetchUserByUsername 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

