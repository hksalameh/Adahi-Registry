
"use client";

import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Using base Label for radio options
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, UserCircle, Heart, Phone, CalendarCheck2, DollarSign, Users, ListTree, MessageSquare, Receipt, FileText, Loader2, Coins } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { AdahiSubmission, DistributionPreference } from "@/lib/types";
import { distributionOptions } from "@/lib/types";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const submissionSchema = z.object({
  donorName: z.string().min(1, "اسم المتبرع مطلوب"),
  sacrificeFor: z.string().min(1, "حقل 'الاضحية باسم' مطلوب"),
  phoneNumber: z.string().regex(/^07[789]\d{7}$/, "رقم الهاتف غير صالح (يجب أن يبدأ بـ 077 أو 078 أو 079 ويتكون من 10 أرقام)"),
  wantsToAttend: z.enum(["yes", "no"], { required_error: "الرجاء تحديد الرغبة في الحضور" }),
  wantsFromSacrifice: z.enum(["yes", "no"], { required_error: "الرجاء تحديد الرغبة في أخذ جزء من الأضحية" }),
  sacrificeWishes: z.string().optional(),
  paymentConfirmed: z.enum(["yes", "no"], { required_error: "الرجاء تأكيد حالة الدفع" }),
  receiptBookNumber: z.string().optional(),
  voucherNumber: z.string().optional(),
  throughIntermediary: z.enum(["yes", "no"], { required_error: "الرجاء تحديد ما إذا كانت الأضحية عن طريق وسيط" }),
  intermediaryName: z.string().optional(),
  distributionPreference: z.enum(["ramtha", "gaza", "donor", "fund"], { required_error: "الرجاء اختيار لمن ستوزع الأضحية" }),
}).superRefine((data, ctx) => {
  if (data.wantsFromSacrifice === "yes" && (!data.sacrificeWishes || data.sacrificeWishes.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "الرجاء كتابة ماذا تريد من الأضحية",
      path: ["sacrificeWishes"],
    });
  }
  if (data.paymentConfirmed === "yes") {
    if (!data.receiptBookNumber || data.receiptBookNumber.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "رقم الدفتر مطلوب عند تأكيد الدفع",
        path: ["receiptBookNumber"],
      });
    }
    if (!data.voucherNumber || data.voucherNumber.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "رقم السند مطلوب عند تأكيد الدفع",
        path: ["voucherNumber"],
      });
    }
  }
  if (data.throughIntermediary === "yes" && (!data.intermediaryName || data.intermediaryName.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "اسم الوسيط مطلوب إذا كانت الأضحية عن طريق أحد",
      path: ["intermediaryName"],
    });
  }
});


type SubmissionFormInputs = z.infer<typeof submissionSchema>;

interface AdahiSubmissionFormProps {
  onFormSubmit?: () => void; 
  defaultValues?: Partial<AdahiSubmission>; 
  isEditing?: boolean;
}

export default function AdahiSubmissionForm({ onFormSubmit, defaultValues, isEditing = false }: AdahiSubmissionFormProps) {
  const { user, addSubmission, updateSubmission, loading: authLoading } = useAuth(); 
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  const form = useForm<SubmissionFormInputs>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      donorName: defaultValues?.donorName || "",
      sacrificeFor: defaultValues?.sacrificeFor || "",
      phoneNumber: defaultValues?.phoneNumber || "",
      wantsToAttend: defaultValues?.wantsToAttend ? "yes" : "no",
      wantsFromSacrifice: defaultValues?.wantsFromSacrifice ? "yes" : "no",
      sacrificeWishes: defaultValues?.sacrificeWishes || "",
      paymentConfirmed: defaultValues?.paymentConfirmed ? "yes" : "no",
      receiptBookNumber: defaultValues?.receiptBookNumber || "",
      voucherNumber: defaultValues?.voucherNumber || "",
      throughIntermediary: defaultValues?.throughIntermediary ? "yes" : "no",
      intermediaryName: defaultValues?.intermediaryName || "",
      distributionPreference: defaultValues?.distributionPreference || undefined,
    },
  });

  useEffect(() => {
    if (!authLoading && !user && !isEditing) { 
      toast({
        title: "مطلوب تسجيل الدخول",
        description: "يجب تسجيل الدخول أولاً لإضافة أضحية.",
        variant: "destructive",
      });
      router.push(`/auth/login?redirect=${pathname}`);
    }
  }, [user, authLoading, router, pathname, toast, isEditing]);


  const wantsFromSacrificeValue = form.watch("wantsFromSacrifice");
  const paymentConfirmedValue = form.watch("paymentConfirmed");
  const throughIntermediaryValue = form.watch("throughIntermediary");

  const processSubmit: SubmitHandler<SubmissionFormInputs> = async (data) => {
    if (!user) {
      toast({ variant: "destructive", title: "غير مصرح به", description: "يجب تسجيل الدخول لحفظ البيانات."});
      router.push(`/auth/login?redirect=${pathname}`);
      return;
    }
    setIsSubmitting(true);
    const submissionData = {
      ...data,
      wantsToAttend: data.wantsToAttend === "yes",
      wantsFromSacrifice: data.wantsFromSacrifice === "yes",
      paymentConfirmed: data.paymentConfirmed === "yes",
      throughIntermediary: data.throughIntermediary === "yes",
      distributionPreference: data.distributionPreference as DistributionPreference,
    };

    let success = false;
    if (isEditing && defaultValues?.id) {
        const result = await updateSubmission(defaultValues.id, submissionData);
        success = !!result;
    } else {
        const result = await addSubmission(submissionData);
        success = !!result;
    }
    
    setIsSubmitting(false);

    if (success) {
      toast({ title: isEditing ? "تم تحديث البيانات بنجاح!" : "تم حفظ البيانات بنجاح!", description: "شكراً لمساهمتك." });
      if (!isEditing) { 
        form.reset({ 
          donorName: "",
          sacrificeFor: "",
          phoneNumber: "",
          wantsToAttend: "no",
          wantsFromSacrifice: "no",
          sacrificeWishes: "",
          paymentConfirmed: "no",
          receiptBookNumber: "",
          voucherNumber: "",
          throughIntermediary: "no",
          intermediaryName: "",
          distributionPreference: undefined,
        });
      }
      if (onFormSubmit) onFormSubmit();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: "لم يتم حفظ البيانات. الرجاء المحاولة مرة أخرى." });
    }
  };
  
  if (authLoading) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl flex items-center gap-2 text-primary">
            <Loader2 className="animate-spin" /> {isEditing ? "تحميل بيانات التعديل..." : "تحميل نموذج الإضافة..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-40">
          <p className="text-muted-foreground">جاري التحميل...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!user && !isEditing) {
    return null; 
  }


  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl flex items-center gap-2 text-primary">
          <ListTree /> {isEditing ? "تعديل بيانات الأضحية" : "إضافة أضحية جديدة"}
        </CardTitle>
        <CardDescription>الرجاء ملء جميع الحقول المطلوبة بعناية.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="donorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><UserCircle className="h-4 w-4" />اسم المتبرع</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: عبدالله محمد" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sacrificeFor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Heart className="h-4 w-4" />الاضحية باسم</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: والده، نفسه، ابنه فلان" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Phone className="h-4 w-4" />رقم التلفون</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="07xxxxxxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="wantsToAttend"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="flex items-center gap-1"><CalendarCheck2 className="h-4 w-4" />يريد الحضور؟</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value} // Use value for controlled component
                        className="flex space-x-4 space-x-reverse"
                        ref={field.ref}
                        name={field.name}
                      >
                        <FormItem className="flex items-center space-x-2 space-x-reverse">
                          <FormControl>
                            <RadioGroupItem value="yes" id={`${field.name}-yes`} />
                          </FormControl>
                          <Label htmlFor={`${field.name}-yes`} className="font-normal">نعم</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-x-reverse">
                          <FormControl>
                             <RadioGroupItem value="no" id={`${field.name}-no`} />
                          </FormControl>
                          <Label htmlFor={`${field.name}-no`} className="font-normal">لا</Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="wantsFromSacrifice"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="flex items-center gap-1"><MessageSquare className="h-4 w-4" />يريد من الأضحية؟</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value} // Use value for controlled component
                      className="flex space-x-4 space-x-reverse"
                      ref={field.ref}
                      name={field.name}
                    >
                      <FormItem className="flex items-center space-x-2 space-x-reverse">
                        <FormControl>
                          <RadioGroupItem value="yes" id={`${field.name}-yes`} />
                        </FormControl>
                        <Label htmlFor={`${field.name}-yes`} className="font-normal">نعم</Label>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-x-reverse">
                        <FormControl>
                           <RadioGroupItem value="no" id={`${field.name}-no`} />
                        </FormControl>
                        <Label htmlFor={`${field.name}-no`} className="font-normal">لا</Label>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {wantsFromSacrificeValue === "yes" && (
              <FormField
                control={form.control}
                name="sacrificeWishes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ماذا يريد من الأضحية؟</FormLabel>
                    <FormControl>
                      <Textarea placeholder="مثال: الربع، النصف، قطعة معينة..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="paymentConfirmed"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="flex items-center gap-1"><DollarSign className="h-4 w-4" />تم الدفع؟</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value} // Use value for controlled component
                        className="flex space-x-4 space-x-reverse"
                        ref={field.ref}
                        name={field.name}
                      >
                        <FormItem className="flex items-center space-x-2 space-x-reverse">
                           <FormControl>
                            <RadioGroupItem value="yes" id={`${field.name}-yes`} />
                           </FormControl>
                          <Label htmlFor={`${field.name}-yes`} className="font-normal">نعم</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-x-reverse">
                          <FormControl>
                            <RadioGroupItem value="no" id={`${field.name}-no`} />
                          </FormControl>
                          <Label htmlFor={`${field.name}-no`} className="font-normal">لا</Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {paymentConfirmedValue === "yes" && (
                <>
                  <FormField
                    control={form.control}
                    name="receiptBookNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Receipt className="h-4 w-4" />رقم الدفتر</FormLabel>
                        <FormControl>
                          <Input placeholder="رقم دفتر الإيصالات" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="voucherNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><FileText className="h-4 w-4" />رقم السند</FormLabel>
                        <FormControl>
                          <Input placeholder="رقم سند القبض" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            <FormField
              control={form.control}
              name="throughIntermediary"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4" />الأضحية عن طريق أحد؟</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value} // Use value for controlled component
                      className="flex space-x-4 space-x-reverse"
                      ref={field.ref}
                      name={field.name}
                    >
                      <FormItem className="flex items-center space-x-2 space-x-reverse">
                        <FormControl>
                          <RadioGroupItem value="yes" id={`${field.name}-yes`} />
                        </FormControl>
                        <Label htmlFor={`${field.name}-yes`} className="font-normal">نعم</Label>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-x-reverse">
                        <FormControl>
                          <RadioGroupItem value="no" id={`${field.name}-no`} />
                        </FormControl>
                        <Label htmlFor={`${field.name}-no`} className="font-normal">لا</Label>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {throughIntermediaryValue === "yes" && (
              <FormField
                control={form.control}
                name="intermediaryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الوسيط</FormLabel>
                    <FormControl>
                      <Input placeholder="اسم الشخص الوسيط" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="distributionPreference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><ListTree className="h-4 w-4" />لمن ستوزع الأضحية؟</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر وجهة التوزيع" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {distributionOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || authLoading || (!user && !isEditing)}>
              {isSubmitting ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : <Save className="ml-2 h-5 w-5" />}
              {isSubmitting ? (isEditing ? "جاري التحديث..." : "جاري الحفظ...") : (isEditing ? "تحديث البيانات" : "حفظ البيانات")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


    

    