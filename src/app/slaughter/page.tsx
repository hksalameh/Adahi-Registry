
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import type { AdahiSubmission } from "@/lib/types";
import { distributionOptions } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Utensils, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

const SlaughterPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, markAsSlaughtered, user } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [submissionsToDisplay, setSubmissionsToDisplay] = useState<AdahiSubmission[]>([]);

  const getDistributionLabel = useCallback((value?: string) => {
    if (!value) return "غير محدد";
    return distributionOptions.find(opt => opt.value === value)?.label || String(value);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
    toast({ title: "تم تحديث البيانات" });
  }, [refreshData, toast]);

  useEffect(() => {
    if (!authLoading && user?.isAdmin) {
      handleRefresh().finally(() => setPageLoading(false));
    } else if (!authLoading && !user?.isAdmin) {
      setPageLoading(false); 
    }
  }, [authLoading, user, handleRefresh]);

  useEffect(() => {
    setSubmissionsToDisplay(allSubmissionsForAdmin);
  }, [allSubmissionsForAdmin]);

  const handleMarkAsSlaughtered = async (submission: AdahiSubmission) => {
    if (typeof markAsSlaughtered !== 'function') {
        toast({ title: "خطأ: وظيفة تحديد الذبح غير متاحة.", variant: "destructive" });
        console.error("markAsSlaughtered is not a function here. Value:", markAsSlaughtered);
        return;
    }
    const success = await markAsSlaughtered(submission.id, submission.donorName, submission.phoneNumber);
    if (success) {
      toast({ title: "تم تحديث حالة الذبح بنجاح" });
    } else {
      toast({ title: "فشل تحديث حالة الذبح", variant: "destructive" });
    }
  };

  const renderSubmissionTable = (submissions: AdahiSubmission[], categoryTitle: string) => {
    if (submissions.length === 0) {
      return <p className="text-muted-foreground text-center py-4">لا توجد أضاحي في هذه الفئة.</p>;
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">م</TableHead>
              <TableHead>اسم المتبرع</TableHead>
              <TableHead>الاضحية باسم</TableHead>
              <TableHead>رقم التلفون</TableHead>
              <TableHead>يريد الحضور</TableHead>
              <TableHead>يريد من الاضحية</TableHead>
              <TableHead>ماذا يريد</TableHead>
              <TableHead>توزع لـ</TableHead>
              <TableHead>حالة الإدخال</TableHead>
              <TableHead>حالة الذبح</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((sub, index) => (
              <TableRow key={sub.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{sub.donorName}</TableCell>
                <TableCell>{sub.sacrificeFor}</TableCell>
                <TableCell>{sub.phoneNumber}</TableCell>
                <TableCell>{sub.wantsToAttend ? "نعم" : "لا"}</TableCell>
                <TableCell>{sub.wantsFromSacrifice ? "نعم" : "لا"}</TableCell>
                <TableCell>{sub.wantsFromSacrifice ? (sub.sacrificeWishes || "-") : "-"}</TableCell>
                <TableCell>{getDistributionLabel(sub.distributionPreference)}</TableCell>
                <TableCell>
                  <Badge variant={sub.status === "entered" ? "default" : "secondary"}
                         className={sub.status === "entered" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-yellow-400 hover:bg-yellow-500 text-black"}>
                    {sub.status === "entered" ? "مدخلة" : "غير مدخلة"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {sub.isSlaughtered ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="mr-2 h-5 w-5" />
                      تم الذبح
                      {sub.slaughterDate && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({format(new Date(sub.slaughterDate), "dd/MM/yy HH:mm", { locale: arSA })})
                        </span>
                      )}
                    </div>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                          <Utensils className="ml-2 h-4 w-4" />
                          ذبح
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>تأكيد عملية الذبح</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد أنك تريد تسجيل ذبح الأضحية للمتبرع: {sub.donorName} (باسم: {sub.sacrificeFor})؟
                            سيتم محاولة إشعار المتبرع.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleMarkAsSlaughtered(sub)}>
                            نعم، تم الذبح
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (authLoading || pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">جاري تحميل صفحة إدارة الذبح...</p>
      </div>
    );
  }

  const ramthaAndDonorSubmissions = submissionsToDisplay.filter(
    (s) => s.distributionPreference === "ramtha" || s.distributionPreference === "donor"
  );
  const gazaSubmissions = submissionsToDisplay.filter(
    (s) => s.distributionPreference === "gaza"
  );
  const fundSubmissions = submissionsToDisplay.filter(
    (s) => s.distributionPreference === "fund"
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2 pb-6 border-b">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Utensils className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          إدارة ذبح الأضاحي
        </h1>
        <p className="text-md md:text-lg text-muted-foreground">
          تتبع وسجل عملية ذبح الأضاحي وأشعر المتبرعين.
        </p>
        <div className="flex justify-center pt-4">
          <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
            تحديث البيانات
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>أضاحي داخل الرمثا وللمتبرعين</CardTitle>
          <CardDescription>قائمة الأضاحي المخصصة للتوزيع داخل الرمثا أو التي طلبها المتبرع لنفسه.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderSubmissionTable(ramthaAndDonorSubmissions, "أضاحي داخل الرمثا وللمتبرعين")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>أضاحي لأهل غزة</CardTitle>
          <CardDescription>قائمة الأضاحي المخصصة لأهل غزة.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderSubmissionTable(gazaSubmissions, "أضاحي لأهل غزة")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>أضاحي لصندوق التكافل والتضامن</CardTitle>
          <CardDescription>قائمة الأضاحي المخصصة لصندوق التكافل والتضامن.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderSubmissionTable(fundSubmissions, "أضاحي لصندوق التكافل والتضامن")}
        </CardContent>
      </Card>
    </div>
  );
};

export default SlaughterPage;
