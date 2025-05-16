
"use client";

import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle, ShieldCheck, LogIn } from "lucide-react"; // UserPlus removed
import { Logo } from "./Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-2 sm:px-4">
        <div className="flex-shrink-0">
          <Logo />
        </div>

        <div className="flex-grow flex justify-center px-2">
          {user && !loading && (
            <span className="text-lg text-muted-foreground flex items-center gap-1 text-center">
              <UserCircle className="h-5 w-5" /> مرحبا, {user.username}
              {user.isAdmin && <ShieldCheck className="h-5 w-5 text-primary" title="Admin" />}
            </span>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          {loading ? (
            <span className="text-xs sm:text-sm text-muted-foreground">جاري التحميل...</span>
          ) : user ? (
            <>
              {user.isAdmin && pathname !== "/admin" && (
                 <Button variant="ghost" size="sm" asChild className="px-2 sm:px-3">
                    <Link href="/admin">الإدارة</Link>
                 </Button>
              )}
              {pathname !== "/dashboard" && !user.isAdmin && (
                <Button variant="ghost" size="sm" asChild className="px-2 sm:px-3">
                    <Link href="/dashboard">الرئيسية</Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={logout} className="px-2 sm:px-3">
                <LogOut className="sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">خروج</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/auth/login" className="flex items-center gap-1">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">دخول</span>
                </Link>
              </Button>
              {/* زر إنشاء حساب جديد تم إزالته من هنا */}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
