// src/app/auth/login/page.tsx

"use client"; 

import LoginForm from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import React, { Suspense } from 'react';
import Image from 'next/image'; // لاستخدام مكون next/image

// مكون بسيط لعرضه أثناء انتظار تحميل LoginForm
function LoginFormFallback() {
  return (
    <div className="space-y-4 text-center py-8">
      <p className="text-muted-foreground">جاري تحميل نموذج تسجيل الدخول...</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Image 
              src="https://placehold.co/100x100.png" // رابط صورة placeholder
              alt="شعار جمعية المركز الاسلامي الخيرية"
              width={80} // يمكنك تعديل العرض
              height={80} // يمكنك تعديل الارتفاع
              className="rounded-md"
              data-ai-hint="islamic charity logo" // تلميح للبحث عن صورة
            />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
            جمعية المركز الاسلامي الخيرية
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            مركز الرمثا للخدمات المجتمعية
          </CardDescription>
          <div className="mx-auto my-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <LockKeyhole size={32} />
          </div>
          <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-primary">
            تسجيل الدخول
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            أدخل بريدك الإلكتروني أو اسم المستخدم وكلمة المرور للوصول إلى حسابك.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
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
