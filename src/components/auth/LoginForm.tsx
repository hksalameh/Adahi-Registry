
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox"; // استيراد Checkbox
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const LOCAL_STORAGE_IDENTIFIER_KEY = 'ADAHI_REMEMBERED_IDENTIFIER';
const LOCAL_STORAGE_REMEMBER_ME_KEY = 'ADAHI_REMEMBER_ME_PREF';

const loginSchema = z.object({
  identifier: z.string().min(1, "البريد الإلكتروني أو اسم المستخدم مطلوب"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  rememberMe: z.boolean().default(false).optional(),
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
      rememberMe: false,
    },
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rememberedIdentifier = localStorage.getItem(LOCAL_STORAGE_IDENTIFIER_KEY);
      const rememberMePreference = localStorage.getItem(LOCAL_STORAGE_REMEMBER_ME_KEY);

      if (rememberMePreference === 'true' && rememberedIdentifier) {
        form.setValue('identifier', rememberedIdentifier);
        form.setValue('rememberMe', true);
      }
    }
  }, [form]);

  const onSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true);
    let emailToLogin = data.identifier;
    
    // التحقق مما إذا كان المعرف هو اسم المستخدم أو البريد الإلكتروني للمدير
    const isAdminLoginAttempt = data.identifier === process.env.NEXT_PUBLIC_ADMIN_USERNAME || data.identifier === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    if (!isAdminLoginAttempt && !(data.identifier.includes('@') && data.identifier.includes('.'))) {
      // إذا لم يكن بريدًا إلكترونيًا وليس محاولة تسجيل دخول للمدير، افترض أنه اسم مستخدم عادي
      const userProfile = await fetchUserByUsername(data.identifier);
      if (userProfile && userProfile.email) {
        emailToLogin = userProfile.email;
      } else {
        toast({
          variant: "destructive",
          title: "خطأ في تسجيل الدخول",
          description: "اسم المستخدم غير موجود أو لم يتم العثور على بريد إلكتروني مطابق. يرجى مراعاة حالة الأحرف.",
        });
        setIsLoading(false);
        return;
      }
    } else if (isAdminLoginAttempt && data.identifier === process.env.NEXT_PUBLIC_ADMIN_USERNAME && process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      // إذا كان محاولة تسجيل دخول المدير باسم المستخدم الخاص بالمدير، استخدم البريد الإلكتروني للمدير
      emailToLogin = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    }
    // إذا كان المعرف بريدًا إلكترونيًا بالفعل (بما في ذلك بريد المدير)، سيبقى emailToLogin كما هو

    const loggedInUser = await login(emailToLogin, data.password);
    setIsLoading(false);

    if (loggedInUser) {
      if (typeof window !== 'undefined') {
        if (data.rememberMe) {
          localStorage.setItem(LOCAL_STORAGE_IDENTIFIER_KEY, data.identifier);
          localStorage.setItem(LOCAL_STORAGE_REMEMBER_ME_KEY, 'true');
        } else {
          localStorage.removeItem(LOCAL_STORAGE_IDENTIFIER_KEY);
          localStorage.setItem(LOCAL_STORAGE_REMEMBER_ME_KEY, 'false');
        }
      }
      toast({ title: "تم تسجيل الدخول بنجاح" });
      const redirectUrl = searchParams.get("redirect") || (loggedInUser.isAdmin ? "/admin" : "/dashboard");
      router.push(redirectUrl);
    } else {
        // رسالة الخطأ من دالة login في AuthContext
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
                <Input placeholder="example@example.com أو اسم_المستخدم" {...field} />
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
        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0 rounded-md border p-3 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  تذكرني
                </FormLabel>
              </div>
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
