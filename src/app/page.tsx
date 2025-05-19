
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log(`[HomePage] useEffect triggered: loading=${loading}, user exists: ${!!user}, user isAdmin: ${user?.isAdmin}`);

    if (!loading) {
      if (!user) {
        console.log("[HomePage] User not found and not loading, redirecting to /auth/login");
        router.push("/auth/login");
      } else if (user.isAdmin) {
        console.log("[HomePage] Admin user found, redirecting to /admin");
        router.push("/admin");
      } else {
        console.log("[HomePage] Non-admin user found, redirecting to /dashboard");
        router.push("/dashboard");
      }
    } else {
      console.log("[HomePage] Still loading authentication state...");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">
          جاري التحقق من المصادقة والتوجيه...
        </p>
      </div>
    );
  }

  // هذا الجزء سيظهر فقط للحظات قصيرة جدًا إذا لم يتم التوجيه فورًا بعد انتهاء التحميل
  // أو إذا كان هناك تأخير في التوجيه.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <p className="text-lg text-muted-foreground">يتم تجهيز الصفحة...</p>
    </div>
  );
}
