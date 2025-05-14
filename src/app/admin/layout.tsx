
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/core/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast"; // Correct import for useToast

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast(); // Correctly initialize toast

  useEffect(() => {
    console.log("[AdminLayout Effect] Checkpoint. Loading:", loading, "User:", JSON.stringify(user), "Pathname:", pathname);
    if (!loading) {
      console.log("[AdminLayout Effect] Auth loading complete.");
      if (!user) {
        console.log("[AdminLayout Effect] No user found, redirecting to login.");
        router.push(`/auth/login?redirect=${pathname}`);
      } else if (!user.isAdmin) {
        console.log(`[AdminLayout Effect] User found (ID: ${user.id}, Username: ${user.username}) but is NOT admin (isAdmin: ${user.isAdmin}). Redirecting to dashboard.`);
        toast({ title: "غير مصرح به", description: "ليس لديك صلاحيات المدير.", variant: "destructive" });
        router.push("/dashboard");
      } else {
        console.log(`[AdminLayout Effect] User (ID: ${user.id}, Username: ${user.username}) IS ADMIN. Allowing access to admin page.`);
      }
    } else {
      console.log("[AdminLayout Effect] Still loading auth state...");
    }
  }, [user, loading, router, pathname, toast]);

  if (loading) {
    console.log("[AdminLayout Render] Auth is loading, showing skeleton.");
    return (
      <div className="flex flex-col min-h-screen bg-secondary/50">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <div className="space-y-6 w-full max-w-2xl text-center">
                <Skeleton className="h-12 w-3/4 mx-auto" />
                <Skeleton className="h-8 w-full mx-auto" />
                <Skeleton className="h-40 w-full mx-auto" />
                <Skeleton className="h-10 w-1/3 mx-auto" />
                <p className="text-muted-foreground">جاري التحقق من صلاحيات المدير...</p>
            </div>
        </main>
      </div>
    );
  }

  if (!user) {
    console.log("[AdminLayout Render] No user (after loading finished), showing login-redirect skeleton (useEffect should handle redirect).");
    return (
      <div className="flex flex-col min-h-screen bg-secondary/50">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <div className="space-y-6 w-full max-w-2xl text-center">
                <p className="text-muted-foreground">يتم توجيهك لصفحة تسجيل الدخول...</p>
            </div>
        </main>
      </div>
    );
  }

  if (!user.isAdmin) {
    console.log(`[AdminLayout Render] User (ID: ${user.id}, Username: ${user.username}) is NOT admin (isAdmin: ${user.isAdmin}), showing dashboard-redirect skeleton (useEffect should handle redirect).`);
    return (
      <div className="flex flex-col min-h-screen bg-secondary/50">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <div className="space-y-6 w-full max-w-2xl text-center">
                 <p className="text-muted-foreground">غير مصرح لك بالدخول. يتم توجيهك...</p>
            </div>
        </main>
      </div>
    );
  }

  console.log(`[AdminLayout Render] User (ID: ${user.id}, Username: ${user.username}) IS ADMIN. Rendering admin content.`);
  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
