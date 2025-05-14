// إذا كنت تستخدم TypeScript، سيكون الملف هكذا (مثلاً app/auth/login/page.tsx)
// إذا كنت تستخدم JavaScript، فقط احذف أنواع TypeScript مثل : React.ReactNode

"use client"; // مهم إذا كان هذا ملف صفحة في App Router ويحتوي على hooks للعميل

import LoginForm from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import React, { Suspense } from 'react'; // <--- استيراد Suspense

// مكون بسيط لعرضه أثناء انتظار تحميل LoginForm
// يمكنك تخصيصه أكثر إذا أردت، مثلاً باستخدام مكونات Skeleton
function LoginFormFallback() {
  return (
    <div className="space-y-4 text-center">
      <p className="text-muted-foreground">جاري تحميل النموذج...</p>
      {/* مثال على Skeleton إذا أردت */}
      {/* <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-300 rounded w-3/4 mx-auto"></div>
        <div className="h-4 bg-gray-300 rounded w-1/2 mx-auto"></div>
      </div> */}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <LockKeyhole size={32} />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">تسجيل الدخول</CardTitle>
          <CardDescription className="text-muted-foreground">
            أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى حسابك.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {/* تغليف LoginForm بـ Suspense */}
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
          
          <p className="text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Link href="/auth/register" className="font-semibold text-primary hover:underline">
              إنشاء حساب جديد
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}