
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox"; 
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
    console.log(`[LoginForm onSubmit] Called with identifier: ${data.identifier}, rememberMe: ${data.rememberMe}`);
    
    const loggedInUser = await login(data.identifier, data.password);
    setIsLoading(false);

    if (loggedInUser) {
      console.log("[LoginForm onSubmit] Login successful. User object from AuthContext.login():", JSON.stringify(loggedInUser));
      console.log("[LoginForm onSubmit] User isAdmin status:", loggedInUser.isAdmin);

      if (typeof window !== 'undefined') {
        if (data.rememberMe) {
          localStorage.setItem(LOCAL_STORAGE_IDENTIFIER_KEY, data.identifier); // Store the original identifier used
          localStorage.setItem(LOCAL_STORAGE_REMEMBER_ME_KEY, 'true');
          console.log(`[LoginForm onSubmit] "Remember me" is true. Stored identifier: ${data.identifier}`);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_IDENTIFIER_KEY);
          localStorage.setItem(LOCAL_STORAGE_REMEMBER_ME_KEY, 'false');
          console.log(`[LoginForm onSubmit] "Remember me" is false. Cleared remembered identifier.`);
        }
      }
      toast({ title: "تم تسجيل الدخول بنجاح" });
      
      const redirectUrlFromParams = searchParams.get("redirect");
      const defaultAdminRedirect = "/admin";
      const defaultUserRedirect = "/dashboard";
      
      let redirectUrl = loggedInUser.isAdmin ? defaultAdminRedirect : defaultUserRedirect;
      if (redirectUrlFromParams) {
        redirectUrl = redirectUrlFromParams;
         // Ensure admin isn't redirected to a non-admin page if ?redirect is set, unless it's intended.
         // For simplicity, if user is admin and redirect is present, we'll honor it.
         // Otherwise, a more complex logic might be needed if admin should always go to /admin regardless of ?redirect
      }
      
      console.log(`[LoginForm onSubmit] Redirecting to: ${redirectUrl}. Based on isAdmin: ${loggedInUser.isAdmin}, redirectParam: ${redirectUrlFromParams}`);
      router.push(redirectUrl);
      // router.refresh(); // Removed this line as router.push should be sufficient
    } else {
        console.log("[LoginForm onSubmit] Login failed. loggedInUser is null or undefined (toast handled in AuthContext).");
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
