
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Label } from "@/components/ui/label"; // Import Label
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

// Updated schema to include markAsAdmin
const registerSchema = z.object({
  username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
  email: z.string().email("البريد الإلكتروني غير صالح").min(1, "البريد الإلكتروني مطلوب"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  confirmPassword: z.string().min(6, "تأكيد كلمة المرور مطلوب"),
  markAsAdmin: z.boolean().default(false).optional(), // New field for marking as admin
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمتا المرور غير متطابقتين",
  path: ["confirmPassword"],
});

type RegisterFormInputs = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  isAdminCreator?: boolean; // Prop to indicate if the form is used by an admin
  onFormSubmit?: () => void; // Optional callback after successful submission
}

export default function RegisterForm({ isAdminCreator = false, onFormSubmit }: RegisterFormProps) {
  const { register, user: currentUser } = useAuth(); // Get current user to double check admin status
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      markAsAdmin: false,
    },
  });

  const onSubmit = async (data: RegisterFormInputs) => {
    setIsLoading(true);
    // Pass data.markAsAdmin to the register function
    const newUser = await register(data.username, data.email, data.password, data.markAsAdmin);
    setIsLoading(false);
    if (newUser) {
      toast({ title: "تم إنشاء الحساب بنجاح!" });
      if (onFormSubmit) {
        onFormSubmit(); // Call callback if provided (e.g., to close a dialog)
      } else {
        // Default behavior if not used in a dialog (e.g., public registration)
        router.push("/auth/login");
      }
      form.reset(); // Reset form after successful submission
    }
    // Toast messages for errors are handled within the register function in AuthContext
  };

  // Ensure only an admin can see the "Mark as Admin" checkbox
  const canMarkAsAdmin = isAdminCreator && currentUser && currentUser.isAdmin;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>اسم المستخدم</FormLabel>
              <FormControl>
                <Input placeholder="مثال: طارق (يمكن أن يكون بالعربية)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>البريد الإلكتروني</FormLabel>
              <FormControl>
                <Input type="email" placeholder="example@example.com" {...field} />
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
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>تأكيد كلمة المرور</FormLabel>
              <FormControl>
                <Input type="password" placeholder="********" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Conditionally render the "Mark as Admin" checkbox */}
        {canMarkAsAdmin && (
          <FormField
            control={form.control}
            name="markAsAdmin"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-x-reverse space-y-0 rounded-md border p-3 shadow-sm">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="markAsAdmin"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <Label htmlFor="markAsAdmin" className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    جعله مسؤولاً؟
                  </Label>
                </div>
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
        </Button>
      </form>
    </Form>
  );
}
