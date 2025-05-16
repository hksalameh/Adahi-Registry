
"use client"; 

import LoginForm from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LockKeyhole } from "lucide-react";
import React, { Suspense } from 'react';
import Image from 'next/image';

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
        <CardHeader className="space-y-3 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-shrink-0">
              <Image 
                src="https://www.islamicc.org/img/logo344.png" 
                alt="شعار جمعية المركز الاسلامي الخيرية"
                width={80}
                height={80}
                className="rounded-md"
                data-ai-hint="islamic charity logo" 
              />
            </div>
            <div className="flex-1 text-center ml-4"> 
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                جمعية المركز الاسلامي الخيرية
              </CardTitle>
              <p className="text-base text-muted-foreground mt-1">
                مركز الرمثا للخدمات المجتمعية
              </p>
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-lg font-semibold text-foreground">اضاحي 2025</p>
          </div>

          <div className="text-center space-y-2">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <LockKeyhole size={28} />
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-primary">
              تسجيل الدخول
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              أدخل بريدك الإلكتروني أو اسم المستخدم وكلمة المرور للوصول إلى حسابك.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
          
          {/* تم إزالة رابط إنشاء حساب جديد من هنا */}
        </CardContent>
      </Card>
    </div>
  );
}
