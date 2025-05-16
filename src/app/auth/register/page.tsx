
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function RegisterPageDisabled() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <ShieldAlert size={32} />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-destructive">
            إنشاء الحسابات معطل
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            إنشاء حسابات المستخدمين الجدد يتم فقط من خلال مدير النظام.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            إذا كنت ترغب في إنشاء حساب، يرجى التواصل مع مدير النظام.
          </p>
          <Link href="/auth/login" className="mt-4 inline-block font-semibold text-primary hover:underline">
            العودة إلى صفحة تسجيل الدخول
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
