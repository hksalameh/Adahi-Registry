"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  identifier: z.string().min(1, "البريد الإلكتروني أو اسم المستخدم مطلوب"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const { login, fetchUserByUsername } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true);
    let emailToLogin = data.identifier;
    
    const isPotentiallyEmail = data.identifier.includes('@') && data.identifier.includes('.');

    if (!isPotentiallyEmail) {
      const userProfile = await fetchUserByUsername(data.identifier);
      if (userProfile && userProfile.email) {
        emailToLogin = userProfile.email;
      } else {
        toast({
          variant: "destructive",
          title: "خطأ في تسجيل الدخول",
          description: "اسم المستخدم غير موجود أو غير مطابق تمامًا لما تم تسجيله (يرجى مراعاة حالة الأحرف)، أو لم يتم العثور على بريد إلكتروني مطابق.",
        });
        setIsLoading(false);
        return;
      }
    }

    const loggedInUser = await login(emailToLogin, data.password);
    setIsLoading(false);

    if (loggedInUser) {
      toast({ title: "تم تسجيل الدخول بنجاح" });
      const redirectUrl = searchParams.get("redirect") || (loggedInUser.isAdmin ? "/admin" : "/dashboard");
      router.push(redirectUrl);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>البريد الإلكتروني أو اسم المستخدم</FormLabel>
              <FormControl>
                <Input placeholder="example@example.com أو اسم_المستخدم (بالعربية)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>كلمة المرور</FormLabel>
              <FormControl>
                <Input type="password" placeholder="********" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
        </Button>
      </form>
    </Form>
  );
}
