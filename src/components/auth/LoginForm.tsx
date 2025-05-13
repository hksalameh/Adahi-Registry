
"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("الرجاء إدخال بريد إلكتروني صالح"),
  password: z.string().min(1, "الرجاء إدخال كلمة المرور"),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit: SubmitHandler<LoginFormInputs> = async (data) => {
    setIsLoading(true);
    setError(null);
    const loggedInUser = await login(data.email, data.password);
    setIsLoading(false);

    if (loggedInUser) {
      toast({ title: "تم تسجيل الدخول بنجاح!", description: "مرحباً بك." });
      const redirectUrlFromParams = searchParams.get('redirect');
      
      if (redirectUrlFromParams) {
        router.push(redirectUrlFromParams);
      } else if (loggedInUser.isAdmin) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } else {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      toast({ variant: "destructive", title: "خطأ في تسجيل الدخول", description: "البيانات المدخلة غير صحيحة أو حدث خطأ." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-hand-heart"><path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 15 6 6"/><path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 0c0 1.1.8 2 1.5 2.7l3.5 3.5Z"/></svg>
          </div>
          <CardTitle className="text-3xl font-bold text-primary">مدير الأضاحي</CardTitle>
          <CardDescription>تسجيل الدخول للمتابعة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" {...register("email")} placeholder="user@example.com" />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" {...register("password")} placeholder="••••••••" />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "جاري تسجيل الدخول..." : <> <LogIn className="mr-2 h-5 w-5" /> تسجيل الدخول </>}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Button variant="link" asChild className="p-0 text-primary">
              <Link href="/register">إنشاء حساب جديد</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
