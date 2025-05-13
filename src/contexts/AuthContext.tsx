
"use client";

import type { User, AdahiSubmission } from "@/lib/types";
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<boolean>;
  register: (username: string, email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  submissions: AdahiSubmission[];
  addSubmission: (submission: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">) => Promise<AdahiSubmission | null>;
  updateSubmissionStatus: (submissionId: string, status: 'pending' | 'entered') => Promise<boolean>;
  updateSubmission: (submissionId: string, data: Partial<AdahiSubmission>) => Promise<AdahiSubmission | null>;
  deleteSubmission: (submissionId: string) => Promise<boolean>;
  allSubmissionsForAdmin: AdahiSubmission[]; // For admin to see all
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock data storage
let mockUsers: User[] = [
  { id: "1", username: "admin", email: "admin@example.com", password: "password", isAdmin: true },
  { id: "2", username: "user", email: "user@example.com", password: "password", isAdmin: false },
];
let mockSubmissions: AdahiSubmission[] = [
    {
        id: "s1",
        userId: "2",
        userEmail: "user@example.com",
        donorName: "محمد علي",
        sacrificeFor: "والده",
        phoneNumber: "0791234567",
        wantsToAttend: true,
        wantsFromSacrifice: true,
        sacrificeWishes: "الربع الأمامي",
        paymentConfirmed: true,
        receiptBookNumber: "101",
        voucherNumber: "202",
        throughIntermediary: false,
        distributionPreference: "gaza",
        submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        status: "pending",
      },
      {
        id: "s2",
        userId: "2",
        userEmail: "user@example.com",
        donorName: "فاطمة حسن",
        sacrificeFor: "نفسها",
        phoneNumber: "0788765432",
        wantsToAttend: false,
        wantsFromSacrifice: false,
        paymentConfirmed: true,
        receiptBookNumber: "102",
        voucherNumber: "203",
        throughIntermediary: true,
        intermediaryName: "أحمد خالد",
        distributionPreference: "ramtha",
        submissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        status: "entered",
      },
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<AdahiSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<AdahiSubmission[]>(mockSubmissions); // for admin

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate session loading
    const storedUser = localStorage.getItem("adahiUser");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      // Filter submissions for the logged-in user
      setSubmissions(allSubmissions.filter(s => s.userId === parsedUser.id));
    }
    setLoading(false);
  }, [allSubmissions]);


  const login = async (identifier: string, pass: string): Promise<boolean> => {
    setLoading(true);
    const foundUser = mockUsers.find(
      (u) => (u.email === identifier || u.username === identifier) && u.password === pass
    );
    if (foundUser) {
      const { password, ...userToStore } = foundUser; // Don't store password in state/localStorage
      setUser(userToStore);
      localStorage.setItem("adahiUser", JSON.stringify(userToStore));
      setSubmissions(allSubmissions.filter(s => s.userId === userToStore.id));
      setLoading(false);
      return true;
    }
    setUser(null);
    setLoading(false);
    return false;
  };

  const register = async (username: string, email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    if (mockUsers.some((u) => u.email === email || u.username === username)) {
      setLoading(false);
      return false; // User already exists
    }
    const newUser: User = {
      id: String(mockUsers.length + 1),
      username,
      email,
      password: pass, // Storing password in mock for simplicity
      isAdmin: false, // New users are not admins by default
    };
    mockUsers.push(newUser);
    const { password, ...userToStore } = newUser;
    setUser(userToStore);
    localStorage.setItem("adahiUser", JSON.stringify(userToStore));
    setSubmissions([]); // New user has no submissions yet
    setLoading(false);
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("adahiUser");
    setSubmissions([]);
    if (pathname !== '/' && pathname !== '/register') {
      router.push("/");
    }
  };

  const addSubmission = async (submissionData: Omit<AdahiSubmission, "id" | "submissionDate" | "status" | "userId" | "userEmail">): Promise<AdahiSubmission | null> => {
    if (!user) return null;
    const newSubmission: AdahiSubmission = {
      ...submissionData,
      id: `s${allSubmissions.length + 1}`,
      userId: user.id,
      userEmail: user.email,
      submissionDate: new Date().toISOString(),
      status: "pending",
    };
    
    const updatedAllSubmissions = [...allSubmissions, newSubmission];
    setAllSubmissions(updatedAllSubmissions); // Update admin view
    mockSubmissions = updatedAllSubmissions; // Update mock global store

    if (user) {
      setSubmissions(updatedAllSubmissions.filter(s => s.userId === user.id)); // Update current user view
    }
    return newSubmission;
  };
  
  const updateSubmissionStatus = async (submissionId: string, status: 'pending' | 'entered'): Promise<boolean> => {
    if (!user || !user.isAdmin) return false; // Only admin can update status

    const updatedSubmissions = allSubmissions.map(s => 
      s.id === submissionId ? { ...s, status } : s
    );
    setAllSubmissions(updatedSubmissions);
    mockSubmissions = updatedSubmissions;

    // If the current user is the one whose submission is updated (e.g. admin editing their own)
    if(user && submissions.find(s => s.id === submissionId)) {
      setSubmissions(updatedSubmissions.filter(s => s.userId === user.id));
    }
    return true;
  };

  const updateSubmission = async (submissionId: string, data: Partial<AdahiSubmission>): Promise<AdahiSubmission | null> => {
    if (!user || !user.isAdmin) return null;

    let updatedSubmission: AdahiSubmission | null = null;
    const updatedSubmissions = allSubmissions.map(s => {
      if (s.id === submissionId) {
        updatedSubmission = { ...s, ...data };
        return updatedSubmission;
      }
      return s;
    });

    setAllSubmissions(updatedSubmissions);
    mockSubmissions = updatedSubmissions;

    if (user) {
         setSubmissions(updatedSubmissions.filter(s => s.userId === user.id));
    }
    return updatedSubmission;
  };

  const deleteSubmission = async (submissionId: string): Promise<boolean> => {
    if (!user || !user.isAdmin) return false;

    const updatedSubmissions = allSubmissions.filter(s => s.id !== submissionId);
    setAllSubmissions(updatedSubmissions);
    mockSubmissions = updatedSubmissions;
    
    if(user) {
        setSubmissions(updatedSubmissions.filter(s => s.userId === user.id));
    }
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, submissions, addSubmission, updateSubmissionStatus, updateSubmission, deleteSubmission, allSubmissionsForAdmin: allSubmissions }}>
      {children}
    </AuthContext.Provider>
  );
};
