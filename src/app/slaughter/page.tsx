
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback, useMemo } from "react"; // Added useMemo
import type { AdahiSubmission } from "@/lib/types";
import { distributionOptions } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Utensils, CheckCircle, Send, XCircle } from "lucide-react";
import { toast as showToast, useToast } from "@/hooks/use-toast"; // Renamed toast to showToast to avoid conflict
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { cn } from "@/lib/utils"; // Import cn utility

const SlaughterPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, markAsSlaughtered, user, sendSlaughterNotification, updateSubmission: updateSubmissionStatusInAuth } = useAuth(); // Added updateSubmission
  const { toast } = useToast(); // This is fine, it's from useToast hook
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [submissionsToDisplay, setSubmissionsToDisplay] = useState<AdahiSubmission[]>([]);
  const [openSlaughterDialog, setOpenSlaughterDialog] = useState<Record<string, boolean>>({});
  const [openUndoSlaughterDialog, setOpenUndoSlaughterDialog] = useState<Record<string, boolean>>({});

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
    // Sort submissions: not slaughtered first, then by original order (or date)
    const sortedSubmissions = [...allSubmissionsForAdmin].sort((a, b) => {
      const aIsDone = a.slaughterStatus === 'notified' || a.slaughterStatus === 'confirmed_slaughtered' || a.isSlaughtered;
      const bIsDone = b.slaughterStatus === 'notified' || b.slaughterStatus === 'confirmed_slaughtered' || b.isSlaughtered;
      if (aIsDone && !bIsDone) return 1; // a (done) comes after b (not done)
      if (!aIsDone && bIsDone) return -1; // a (not done) comes before b (done)
      // If both are done or both are not done, maintain original order (or sort by date if needed)
      // For now, we rely on Firestore's initial orderBy, or you can add secondary sort here
      const dateA = a.submissionDate ? new Date(a.submissionDate).getTime() : 0;
      const dateB = b.submissionDate ? new Date(b.submissionDate).getTime() : 0;
      return dateB - dateA; // Default to descending by submission date if slaughter status is same
    });
    setSubmissionsToDisplay(sortedSubmissions);
  }, [allSubmissionsForAdmin]);

  const updateSubmissionSlaughterStatus = async (submissionId: string, newStatus: AdahiSubmission['slaughterStatus'], isSlaughteredFlag?: boolean) => {
      console.log(`Attempting to update submission ${submissionId} status to ${newStatus}, isSlaughtered: ${isSlaughteredFlag}`);
      
      const updatePayload: Partial<AdahiSubmission> = { slaughterStatus: newStatus };
      if (isSlaughteredFlag !== undefined) {
        updatePayload.isSlaughtered = isSlaughteredFlag;
        if (isSlaughteredFlag && newStatus !== 'pending') { // Only set slaughterDate if being marked as slaughtered
            updatePayload.slaughterDate = new Date().toISOString();
        } else if (!isSlaughteredFlag && newStatus === 'pending') { // Clear slaughterDate if undoing
            updatePayload.slaughterDate = undefined; // Or null, depending on how Firestore handles it
        }
      }

      const success = await updateSubmissionStatusInAuth(submissionId, updatePayload);

       if (success) {
           toast({ title: `تم تحديث حالة الأضحية بنجاح` });
           await refreshData(); // Refresh to get the latest data and re-sort
       } else {
           toast({ title: `فشل تحديث حالة الأضحية`, variant: "destructive" });
       }
  };


  const handleMarkAsSlaughteredClick = (submission: AdahiSubmission) => {
      setOpenSlaughterDialog(prev => ({ ...prev, [submission.id]: true }));
  };

  const handleConfirmMarkAsSlaughtered = async (submission: AdahiSubmission) => {
      await updateSubmissionSlaughterStatus(submission.id, 'confirmed_slaughtered', true); // Using confirmed_slaughtered and setting isSlaughtered to true
      setOpenSlaughterDialog(prev => ({ ...prev, [submission.id]: false }));
  };

   const handleUndoSlaughterClick = (submission: AdahiSubmission) => {
       setOpenUndoSlaughterDialog(prev => ({ ...prev, [submission.id]: true }));
   };

   const handleConfirmUndoSlaughter = async (submission: AdahiSubmission) => {
        await updateSubmissionSlaughterStatus(submission.id, 'pending', false); // Back to pending, isSlaughtered to false
        setOpenUndoSlaughterDialog(prev => ({ ...prev, [submission.id]: false }));
   };

   const handleSendNotification = async (submission: AdahiSubmission) => {
       console.log("[SlaughterPage] handleSendNotification called for submission:", submission.id);
       toast({ title: "جاري إرسال الإشعار..." });

       const notificationSuccess = await sendSlaughterNotification(submission.id, submission.donorName, submission.phoneNumber);

       if (notificationSuccess) {
            // The sendSlaughterNotification in AuthContext now updates to 'notified'
            // So, we just need to refresh data here.
            await refreshData();
            toast({ title: "تم محاولة إرسال الإشعار بنجاح" });
       } else {
            toast({ title: "فشل محاولة إرسال الإشعار", variant: "destructive" });
       }
   };

  const renderSubmissionTable = (submissions: AdahiSubmission[], _categoryTitle: string) => {
    if (submissions.length === 0) {
      return <p className="text-muted-foreground text-center py-4">لا توجد أضاحي في هذه الفئة.</p>;
    }

    const sortedSubmissions = useMemo(() => {
        return [...submissions].sort((a, b) => {
            const aIsDone = a.slaughterStatus === 'notified' || a.slaughterStatus === 'confirmed_slaughtered' || a.isSlaughtered;
            const bIsDone = b.slaughterStatus === 'notified' || b.slaughterStatus === 'confirmed_slaughtered' || b.isSlaughtered;

            if (aIsDone && !bIsDone) return 1;
            if (!aIsDone && bIsDone) return -1;
            
            const dateA = a.submissionDate ? new Date(a.submissionDate).getTime() : 0;
            const dateB = b.submissionDate ? new Date(b.submissionDate).getTime() : 0;
            return dateB - dateA; // Keep most recent non-slaughtered at top
        });
    }, [submissions]);


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
              <TableHead>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSubmissions.map((sub, index) => {
              const isActuallySlaughtered = sub.isSlaughtered || sub.slaughterStatus === 'confirmed_slaughtered' || sub.slaughterStatus === 'notified';
              return (
              <TableRow 
                key={sub.id}
                className={cn(
                    isActuallySlaughtered ? "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/40" : "",
                    sub.paymentConfirmed && !isActuallySlaughtered ? "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-800/40" : ""
                )}
              >
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
                <TableCell className="flex items-center space-x-1 rtl:space-x-reverse">
                  {(sub.slaughterStatus === 'pending' || !sub.slaughterStatus) && (
                     <AlertDialog
                         open={openSlaughterDialog[sub.id] || false}
                         onOpenChange={(isOpen) => setOpenSlaughterDialog(prev => ({ ...prev, [sub.id]: isOpen }))}
                     >
                       <AlertDialogTrigger asChild>
                         <Button
                             variant="outline"
                             size="sm"
                             className="bg-yellow-400 hover:bg-yellow-500 text-black px-2 py-1 text-xs"
                             onClick={() => handleMarkAsSlaughteredClick(sub)}
                         >
                           <Utensils className="ml-1 h-3 w-3" />
                           تم الذبح
                         </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>تأكيد عملية الذبح</AlertDialogTitle>
                           <AlertDialogDescription>
                             هل أنت متأكد أنك تريد تسجيل ذبح الأضحية للمتبرع: {sub.donorName} (باسم: {sub.sacrificeFor})؟
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>إلغاء</AlertDialogCancel>
                           <AlertDialogAction onClick={() => handleConfirmMarkAsSlaughtered(sub)}>
                             نعم، تم الذبح
                           </AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                     </AlertDialog>
                  )}

                  {(sub.slaughterStatus === 'confirmed_slaughtered') && (
                      <>
                          <AlertDialog
                              open={openUndoSlaughterDialog[sub.id] || false}
                              onOpenChange={(isOpen) => setOpenUndoSlaughterDialog(prev => ({ ...prev, [sub.id]: isOpen }))}
                          >
                              <AlertDialogTrigger asChild>
                                  <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-xs"
                                      onClick={() => handleUndoSlaughterClick(sub)}
                                  >
                                      <CheckCircle className="ml-1 h-3 w-3" />
                                      تم الذبح
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>التراجع عن تسجيل الذبح</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          هل أنت متأكد أنك أخطأت في تسجيل ذبح الأضحية للمتبرع: {sub.donorName}؟
                                          بالتراجع سيعود الزر إلى اللون الأصفر.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleConfirmUndoSlaughter(sub)}>
                                          نعم، أريد التراجع
                                      </AlertDialogAction>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>

                           <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSendNotification(sub)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 text-xs"
                            >
                              <Send className="ml-1 h-3 w-3" />
                              إرسال إشعار
                          </Button>
                      </>
                  )}

                   {sub.slaughterStatus === 'notified' && (
                        <div className="flex items-center text-green-700 font-semibold text-xs whitespace-nowrap">
                           <CheckCircle className="mr-1 h-4 w-4" />
                           تم وأُشعر
                           {sub.slaughterDate && (
                             <span className="text-xs text-muted-foreground ml-1">
                               ({format(new Date(sub.slaughterDate), "dd/MM HH:mm", { locale: arSA })})
                             </span>
                           )}
                         </div>
                   )}
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (authLoading || pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">\
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
