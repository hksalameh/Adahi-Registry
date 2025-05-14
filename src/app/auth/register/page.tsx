
import RegisterForm from "@/components/auth/RegisterForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <UserPlus size={32} />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">إنشاء حساب جديد</CardTitle>
          <CardDescription className="text-muted-foreground">
            املأ النموذج أدناه لإنشاء حسابك.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <RegisterForm />
           <p className="text-center text-sm text-muted-foreground">
            لديك حساب بالفعل؟{" "}
            <Link href="/auth/login" className="font-semibold text-primary hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
