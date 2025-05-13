
"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import Link from "next/link";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <UserCircle className="h-5 w-5" /> مرحبا, {user.username}
                {user.isAdmin && <ShieldCheck className="h-5 w-5 text-primary" title="Admin" />}
              </span>
              {user.isAdmin && (
                 <Button variant="ghost" asChild>
                    <Link href="/admin">لوحة التحكم للمدير</Link>
                 </Button>
              )}
               <Button variant="ghost" asChild>
                  <Link href="/dashboard">لوحة التحكم</Link>
               </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                تسجيل الخروج
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
