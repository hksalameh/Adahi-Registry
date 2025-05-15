
"use client";

import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle, ShieldCheck, LogIn, UserPlus } from "lucide-react"; 
import { Logo } from "./Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Left: Logo */}
        <div className="flex-shrink-0">
          <Logo />
        </div>

        {/* Center: Welcome Message (only if user is logged in) */}
        <div className="flex-grow flex justify-center">
          {user && !loading && (
            <span className="text-lg text-muted-foreground flex items-center gap-1">
              <UserCircle className="h-5 w-5" /> مرحبا, {user.username}
              {user.isAdmin && <ShieldCheck className="h-5 w-5 text-primary" title="Admin" />}
            </span>
          )}
        </div>

        {/* Right: Auth Actions & Other Buttons */}
        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
          {loading ? (
            <span className="text-sm text-muted-foreground">جاري التحميل...</span>
          ) : user ? (
            <>
              {user.isAdmin && pathname !== "/admin" && (
                 <Button variant="ghost" asChild>
                    <Link href="/admin">الإدارة</Link>
                 </Button>
              )}
              {/* Conditional rendering for dashboard link was removed in previous request if user is on dashboard. Keeping it for now. */}
              {pathname !== "/dashboard" && ( // Consider if this should always be visible or based on current page for non-admin users
                <Button variant="ghost" asChild>
                    <Link href="/dashboard">لوحة التحكم</Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="ml-2 h-4 w-4" />
                تسجيل الخروج
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/auth/login" className="flex items-center gap-1">
                  <LogIn className="h-4 w-4" />
                  تسجيل الدخول
                </Link>
              </Button>
              <Button variant="default" asChild>
                <Link href="/auth/register" className="flex items-center gap-1">
                  <UserPlus className="h-4 w-4" />
                  إنشاء حساب
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
