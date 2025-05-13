
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/core/Header";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push(`/auth/login?redirect=${pathname}`);
      } else if (!user.isAdmin) {
        toast({ title: "غير مصرح به", description: "ليس لديك صلاحيات المدير.", variant: "destructive" });
        router.push("/dashboard"); 
      }
    }
  }, [user, loading, router, pathname]);

  if (loading || !user || !user.isAdmin) {
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

  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

// Helper toast function (consider moving to a utility or using a global toast context if not already done)
import { toast as appToast } from "@/hooks/use-toast"; 
const toast = appToast;
