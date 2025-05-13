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
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<AppUser | null>;
  register: (username: string, email: string, pass: string) => Promise<AppUser | null>;
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail'>>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[];
  fetchUserById: (userId: string) => Promise<AppUser | null>;
  fetchUserByUsername: (username: string) => Promise<AppUser | null>;
  refreshData: () => Promise<void>;
}

// تأكد من أن هذا هو User UID الصحيح للمدير الخاص بك
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
        // isAdmin يتم تحديدها عند إنشاء المستخدم أو بواسطة المدير لاحقًا
        return {
          id: userDocSnap.id,
          email: userData.email || "", // التأكد من وجود قيمة افتراضية
          username: userData.username || "مستخدم", // التأكد من وجود قيمة افتراضية
          isAdmin: userData.isAdmin === true, // التحقق بشكل صريح من true
        } as AppUser;
      } else {
         // حالة خاصة إذا كان المستخدم هو المدير ولم يتم إنشاء مستنده بعد
         if (userId === ADMIN_UID) {
          // يمكنك هنا اختيار إنشاء مستند المدير إذا لم يكن موجودًا،
          // أو إرجاع بيانات افتراضية له. حاليًا نرجع null إذا لم يكن المستند موجودًا.
          console.warn(`Admin user document with UID ${ADMIN_UID} not found in Firestore.`);
        }
        return null;
      }
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return null;
    }
  }, [db]); // إزالة toast من الاعتماديات إذا لم تكن مستخدمة مباشرة هنا

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
      return {
        id: userDoc.id,
        email: userData.email || "",
        username: userData.username || "مستخدم",
        isAdmin: userData.isAdmin === true,
      } as AppUser;

    } catch (error) {
      console.error("Error fetching user by username:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب بيانات المستخدم." });
      return null;
    }
  }, [db, toast]);


  // Effect for Firebase initialization and auth state listener
  useEffect(() => {
    if (!auth || !db) {
      console.warn("Auth or DB service not available for onAuthStateChanged. Check Firebase configuration.");
      setLoading(false);
      setUser(null); // Ensure user is null if Firebase services aren't ready
      return;
    }
  
    let networkEnabled = false;
    enableNetwork(db)
      .then(() => {
        networkEnabled = true;
        console.log("Firestore network enabled.");
      })
      .catch(err => console.error("Error enabling network for Firestore:", err));
  
    const unsubscribeAuthStateChanged = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        const appUser = await fetchUserById(firebaseUser.uid);
        if (appUser) {
            // نستخدم البيانات من Firestore بشكل أساسي، ونستكملها ببيانات Firebase Auth إذا لزم الأمر
            setUser({
                ...appUser, // يتضمن id, username, isAdmin من Firestore
                email: firebaseUser.email || appUser.email, // استخدام email من Auth كأولوية إذا كان متاحًا
            });
        } else {
            // هذا الوضع قد يحدث إذا تم حذف مستند المستخدم من Firestore لكن المستخدم لا يزال مسجلاً في Auth
            // أو إذا كان مستخدمًا جديدًا ولم تتم عملية كتابة مستند Firestore بعد (نادر الحدوث هنا)
            console.warn(`User with UID ${firebaseUser.uid} authenticated but no Firestore document found. Logging out or creating one might be necessary.`);
            // كإجراء وقائي، يمكن تسجيل خروج المستخدم أو محاولة إنشاء مستند له
            // حاليًا، سنقوم بتعيين مستخدم ببيانات محدودة من Auth
             setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || "",
                username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "مستخدم جديد",
                isAdmin: firebaseUser.uid === ADMIN_UID, // isAdmin تُحسب بناءً على UID المدير
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  
    return () => {
      unsubscribeAuthStateChanged();
      // لا حاجة لـ disableNetwork إلا إذا كنت تريد ذلك بشكل صريح عند تفكيك المكون
      // if (networkEnabled) {
      //   disableNetwork(db).catch(err => console.error("Error disabling network for Firestore:", err));
      // }
    };
  }, [fetchUserById]); // إزالة auth و db من الاعتماديات إذا كانتا ثابتتين بعد التهيئة الأولى

  // Effect for Firestore data subscriptions, dependent on user
  useEffect(() => {
    if (!db) {
      console.warn("Firestore DB not available for data subscriptions.");
      setSubmissions([]);
      setAllSubmissions([]);
      return;
    }
    if (!user) {
        setSubmissions([]);
        setAllSubmissions([]); // مسح بيانات المدير أيضًا إذا لم يكن هناك مستخدم
        return () => {}; // No active listeners if no user
    }

    let unsubscribeFirestoreListeners: (() => void) | null = null;

    if (user.isAdmin && user.id === ADMIN_UID) { // تأكد أن المستخدم هو المدير المحدد
      const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
      unsubscribeFirestoreListeners = onSnapshot(adminQuery, (querySnapshot) => {
        const subs = querySnapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            ...data,
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString(): new Date().toISOString()),
          } as AdahiSubmission;
        });
        setAllSubmissions(subs);
      }, (error) => {
        console.error("Error fetching admin submissions:", error);
         if (error.message.includes("offline")) {
           toast({ variant: "destructive", title: "غير متصل", description: "لا يمكن جلب بيانات المدير لأنك غير متصل بالإنترنت." });
        } else if (error.code === 'permission-denied'){
           toast({ variant: "destructive", title: "خطأ في الصلاحيات", description: "ليس لديك الصلاحية الكافية لجلب بيانات المدير." });
        }
         else {
          toast({ variant: "destructive", title: "خطأ في جلب بيانات المدير", description: `فشل في جلب الأضاحي: ${error.message}` });
        }
      });
    }
    
    // استمع دائمًا لبيانات المستخدم الحالي بغض النظر عن كونه مديرًا أم لا
    // هذا يضمن أن المستخدم العادي يرى بياناته، والمدير يرى بياناته أيضًا (إذا كان لديه أي إدخالات شخصية)
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
      setSubmissions(subs); // هذه هي بيانات المستخدم الحالي دائمًا
    }, (error) => {
      console.error("Error fetching user submissions:", error);
      if (error.code === 'failed-precondition' && error.message.includes('requires an index')) {
         toast({ variant: "destructive", title: "خطأ في قاعدة البيانات", description: "يتطلب الاستعلام فهرسًا. يرجى مراجعة Firebase Console لإنشاء الفهرس المطلوب." });
      } else if (error.message.includes("offline")) {
         toast({ variant: "destructive", title: "غير متصل", description: "لا يمكن جلب البيانات لأنك غير متصل بالإنترنت." });
      } else if (error.code === 'permission-denied'){
         toast({ variant: "destructive", title: "خطأ في الصلاحيات", description: "ليس لديك الصلاحية الكافية لجلب بياناتك." });
      } else {
        toast({ variant: "destructive", title: "خطأ في جلب البيانات", description: `فشل في جلب الأضاحي: ${error.message}` });
      }
    });
    
    return () => {
        if (unsubscribeFirestoreListeners) unsubscribeFirestoreListeners();
        unsubscribeUserSubmissions();
    };
  }, [db, user, toast]);


  const login = async (identifier: string, pass: string): Promise<AppUser | null> => {
    if (!auth || !db) {
        toast({variant: "destructive", title: "خطأ في التهيئة", description: "نظام المصادقة غير جاهز."});
        return null;
    }
    setLoading(true);
    let emailToLogin = "";
    let userProfileToAuth: AppUser | null = null;

    // تحقق إذا كان المعرف هو البريد الإلكتروني للمدير
    if (identifier.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com").toLowerCase()) {
        emailToLogin = identifier;
        userProfileToAuth = await fetchUserById(ADMIN_UID);
         if (!userProfileToAuth) {
            // هذا يعني أن مستند المدير غير موجود في Firestore، وهو أمر يجب التعامل معه
            // قد نقوم بإنشائه هنا أو الاعتماد على onAuthStateChanged لإنشائه إذا لم يكن موجودًا
            console.warn(`Admin user document with UID ${ADMIN_UID} not found. Ensure it exists in Firestore or will be created.`);
             // استخدام بيانات افتراضية مؤقتة إذا لم يتم العثور على مستند المدير
            userProfileToAuth = {
                id: ADMIN_UID,
                email: emailToLogin,
                username: "Admin", // اسم مستخدم افتراضي للمدير
                isAdmin: true,
            };
        } else if (!userProfileToAuth.isAdmin) {
             toast({
              variant: "destructive",
              title: "خطأ في تسجيل الدخول",
              description: "هذا الحساب ليس لديه صلاحيات المدير.",
            });
            setLoading(false);
            return null;
        }
    } else {
        // إذا لم يكن بريد المدير، افترض أنه اسم مستخدم عادي
        userProfileToAuth = await fetchUserByUsername(identifier);
        if (userProfileToAuth && userProfileToAuth.email) {
            emailToLogin = userProfileToAuth.email;
            if (userProfileToAuth.isAdmin && userProfileToAuth.id !== ADMIN_UID) {
              // هذا السيناريو يعني أن مستخدمًا لديه isAdmin: true ولكنه ليس المدير الأساسي
              // قد ترغب في التعامل مع هذا بشكل مختلف، أو السماح به
              console.warn(`User ${identifier} has isAdmin flag but is not the primary admin.`);
            }
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
      
      // بعد تسجيل الدخول الناجح، onAuthStateChanged سيتولى جلب بيانات المستخدم من Firestore وتحديث الحالة
      // لكن لإرجاع المستخدم مباشرة هنا، يمكننا استخدام userProfileToAuth الذي جلبناه بالفعل أو البيانات الأساسية
      const loggedInUser = userProfileToAuth ? {
        ...userProfileToAuth,
        id: firebaseUser.uid, // تأكد من استخدام UID من Firebase Auth
        email: firebaseUser.email || userProfileToAuth.email, // استخدام الأحدث من Auth
      } : {
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "مستخدم",
        isAdmin: firebaseUser.uid === ADMIN_UID,
      };
      
      setLoading(false);
      return loggedInUser;

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

    const arabicUsernameRegex = /^[\u0600-\u06FF\s\u0660-\u0669a-zA-Z0-9_.-]{3,}$/; // السماح بحروف عربية، إنجليزية، أرقام، وبعض الرموز
    if (!arabicUsernameRegex.test(username)) {
        toast({variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل ويمكن أن يحتوي على حروف عربية، إنجليزية، أرقام، والرموز (- . _).", duration: 7000});
        return null;
    }

    const existingUserByUsername = await fetchUserByUsername(username);
    if (existingUserByUsername) {
        toast({variant: "destructive", title: "خطأ في التسجيل", description: "اسم المستخدم هذا موجود بالفعل. الرجاء اختيار اسم آخر."});
        return null;
    }

    // التحقق من البريد الإلكتروني لا يزال ضروريًا على مستوى Auth
    // Firestore check for email is redundant if Auth prevents duplicate emails, but good for UX
    // const usersRef = collection(db, "users");
    // const emailQuery = query(usersRef, where("email", "==", email));
    // const emailQuerySnapshot = await getDocs(emailQuery);
    // if (!emailQuerySnapshot.empty) {
    //     toast({variant: "destructive", title: "خطأ في التسجيل", description: "البريد الإلكتروني مستخدم مسبقاً."});
    //     return null;
    // }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      const isAdminUser = firebaseUser.uid === ADMIN_UID; // يتم تحديد المدير بناءً على UID
      const newUserFirestoreData = {
        username,
        email: firebaseUser.email || email, // استخدام البريد الإلكتروني من Firebase Auth إذا كان متاحًا
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
        errorMessage += "كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).";
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
        // setUser(null) will be handled by onAuthStateChanged
        // toast({title: "تم تسجيل الخروج بنجاح"}); // onAuthStateChanged سيقوم بتحديث الواجهة، قد لا تحتاج هذا
        router.push("/auth/login"); // توجيه المستخدم دائمًا لصفحة تسجيل الدخول بعد الخروج
    } catch (error: any) {
        console.error("Logout error:", error);
        toast({variant: "destructive", title: "خطأ في تسجيل الخروج", description: error.message || "فشل تسجيل الخروج."});
    }
  };

  const refreshData = useCallback(async () => {
    if (!db || !user) {
      console.log("RefreshData: DB not available or no user. Skipping refresh.");
      return;
    }
    console.log("RefreshData: Starting data refresh...");
    setLoading(true);
    try {
      if (user.isAdmin && user.id === ADMIN_UID) {
        console.log("RefreshData: Fetching admin submissions.");
        const adminQuery = query(collection(db, "submissions"), orderBy("submissionDate", "desc"));
        const querySnapshot = await getDocs(adminQuery);
        const subs = querySnapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id, ...data,
            submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString()),
          } as AdahiSubmission;
        });
        setAllSubmissions(subs);
        console.log(`RefreshData: Fetched ${subs.length} admin submissions.`);
      }
      
      console.log(`RefreshData: Fetching submissions for user ${user.id}.`);
      const userQuery = query(collection(db, "submissions"), where("userId", "==", user.id), orderBy("submissionDate", "desc"));
      const userQuerySnapshot = await getDocs(userQuery);
      const userSubs = userQuerySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id, ...data,
          submissionDate: data.submissionDate?.toDate ? data.submissionDate.toDate().toISOString() : (data.submissionDate ? new Date(data.submissionDate).toISOString() : new Date().toISOString()),
          lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : (data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString()),
        } as AdahiSubmission;
      });
      setSubmissions(userSubs);
      console.log(`RefreshData: Fetched ${userSubs.length} submissions for user ${user.id}.`);

    } catch (error) {
        console.error("Error refreshing data:", error);
        toast({variant: "destructive", title: "خطأ", description: "فشل في تحديث البيانات."});
    }
    setLoading(false);
    console.log("RefreshData: Data refresh complete.");
  }, [db, user, toast]);


  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail" | "lastUpdatedBy" | "lastUpdatedByEmail" | "lastUpdated">): Promise<AdahiSubmission | null> => {
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
        userEmail: user.email, // استخدام البريد الإلكتروني من كائن المستخدم الحالي
        submissionDate: serverTimestamp(),
        status: "pending" as const,
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.id, // ID المستخدم الذي قام بالتحديث
        lastUpdatedByEmail: user.email, // بريد المستخدم الذي قام بالتحديث
      };
      const docRef = await addDoc(collection(db, "submissions"), newSubmissionData);
      // لا حاجة لـ refreshData() هنا لأن onSnapshot سيقوم بتحديث البيانات تلقائيًا
      const clientSideRepresentation: AdahiSubmission = {
        ...submissionData,
        id: docRef.id,
        userId: newSubmissionData.userId,
        userEmail: newSubmissionData.userEmail,
        status: "pending",
        submissionDate: new Date().toISOString(), // تمثيل تقريبي للوقت الحالي
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: newSubmissionData.lastUpdatedBy,
        lastUpdatedByEmail: newSubmissionData.lastUpdatedByEmail,
      };
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
    if (!user || !user.isAdmin || user.id !== ADMIN_UID) { // فقط المدير المحدد يمكنه تحديث الحالة
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
      // لا حاجة لـ refreshData() هنا لأن onSnapshot سيقوم بتحديث البيانات تلقائيًا
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

  const updateSubmission = async (submissionId: string, data: Partial<Omit<AdahiSubmission, 'id' | 'userId' | 'userEmail' | 'submissionDate' | 'lastUpdated' | 'lastUpdatedBy' | 'lastUpdatedByEmail'>>): Promise<AdahiSubmission | null> => {
    if (!db) {
      toast({ variant: "destructive", title: "خطأ", description: "قاعدة البيانات غير مهيأة." });
      return null;
    }
    if (!user || !user.isAdmin || user.id !== ADMIN_UID) { // فقط المدير المحدد يمكنه تحديث البيانات
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
      // لا حاجة لـ refreshData() هنا لأن onSnapshot سيقوم بتحديث البيانات تلقائيًا

      const updatedDocSnap = await getDoc(submissionDocRef); // جلب المستند المحدث للتأكد
      if (updatedDocSnap.exists()) {
        const updatedDataFirebase = updatedDocSnap.data();
        return {
          id: updatedDocSnap.id,
          ...(updatedDataFirebase as Omit<AdahiSubmission, 'id' | 'submissionDate' | 'lastUpdated'>),
          submissionDate: updatedDataFirebase.submissionDate?.toDate ? updatedDataFirebase.submissionDate.toDate().toISOString() : (updatedDataFirebase.submissionDate ? new Date(updatedDataFirebase.submissionDate).toISOString(): new Date().toISOString()),
          lastUpdated: updatedDataFirebase.lastUpdated?.toDate ? updatedDataFirebase.lastUpdated.toDate().toISOString() : (updatedDataFirebase.lastUpdated ? new Date(updatedDataFirebase.lastUpdated).toISOString(): new Date().toISOString()),
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
    if (!user || !user.isAdmin || user.id !== ADMIN_UID) { // فقط المدير المحدد يمكنه الحذف
        toast({variant: "destructive", title: "غير مصرح به", description: "ليس لديك صلاحية لحذف البيانات."});
        return false;
    }
    try {
      const submissionDocRef = doc(db, "submissions", submissionId);
      await deleteDoc(submissionDocRef);
      // لا حاجة لـ refreshData() هنا لأن onSnapshot سيقوم بتحديث البيانات تلقائيًا
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
        submissions, // بيانات المستخدم الحالي
        addSubmission,
        updateSubmissionStatus,
        updateSubmission,
        deleteSubmission,
        allSubmissionsForAdmin: allSubmissions, // بيانات المدير
        fetchUserById,
        fetchUserByUsername,
        refreshData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

