
import LoginForm from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";

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
          <LoginForm />
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
