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
import { Loader2, RefreshCw, Utensils, CheckCircle, Send, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

const SlaughterPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, markAsSlaughtered, user } = useAuth();
  const { toast } = useToast();
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
    setSubmissionsToDisplay(allSubmissionsForAdmin);
  }, [allSubmissionsForAdmin]);

  const updateSubmissionStatus = async (submissionId: string, status: AdahiSubmission['slaughterStatus']) => {
      // This is a placeholder function. You'll need to implement the actual logic
      // to update the slaughterStatus in your backend/data source.
      // For demonstration, we'll just update the local state (which won't persist).
      console.log(`Attempting to update submission ${submissionId} status to ${status}`);

      // In a real application, you would call an API/function here
      // const success = await yourApi.updateSlaughterStatus(submissionId, status);

      // For now, let's simulate a successful update and update local state
       setSubmissionsToDisplay(prevSubmissions =>
           prevSubmissions.map(sub =>
               sub.id === submissionId ? { ...sub, slaughterStatus: status } : sub
           )
       );
       toast({ title: `تم تحديث حالة الأضحية إلى: ${status}` });


      // Handle potential errors if the update fails
      // if (!success) {
      //     toast({ title: `فشل تحديث حالة الأضحية إلى: ${status}`, variant: "destructive" });
      // }
  };


  const handleMarkAsSlaughteredClick = (submission: AdahiSubmission) => {
      setOpenSlaughterDialog(prev => ({ ...prev, [submission.id]: true }));
  };

  const handleConfirmMarkAsSlaughtered = async (submission: AdahiSubmission) => {
      // Call function to update status to 'marked_slaughtered'
      await updateSubmissionStatus(submission.id, 'marked_slaughtered');
      setOpenSlaughterDialog(prev => ({ ...prev, [submission.id]: false }));
      // Note: The original handleMarkAsSlaughtered included sending the notification.
      // We need a separate function for sending notifications now.
      // The logic to send notification is removed from here.
  };

   const handleUndoSlaughterClick = (submission: AdahiSubmission) => {
       setOpenUndoSlaughterDialog(prev => ({ ...prev, [submission.id]: true }));
   };

   const handleConfirmUndoSlaughter = async (submission: AdahiSubmission) => {
        // Call function to update status back to 'pending'
        await updateSubmissionStatus(submission.id, 'pending');
        setOpenUndoSlaughterDialog(prev => ({ ...prev, [submission.id]: false }));
   };

   const handleSendNotification = async (submission: AdahiSubmission) => {
       // This is a placeholder. You need to implement the actual function
       // to send SMS and WhatsApp messages. This might involve calling
       // a function from useAuth or a separate API call.
       console.log(`Attempting to send notification for submission ${submission.id}`);
       toast({ title: "جاري إرسال الإشعار..." });

       // Simulate sending notification
       // const notificationSuccess = await yourApi.sendNotification(submission.id, submission.phoneNumber, submission.donorName);
        const notificationSuccess = true; // Simulate success

       if (notificationSuccess) {
            await updateSubmissionStatus(submission.id, 'notified'); // Update status to notified
            toast({ title: "تم إرسال الإشعار بنجاح" });
       } else {
            toast({ title: "فشل إرسال الإشعار", variant: "destructive" });
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
              <TableHead>الإجراءات</TableHead> {/* Changed from حالة الذبح to الإجراءات */}
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
                <TableCell className="flex items-center space-x-2"> {/* Added flex and space */}
                  {(sub.slaughterStatus === 'pending' || sub.slaughterStatus === undefined) && ( // Added undefined check for new property
                     <AlertDialog
                         open={openSlaughterDialog[sub.id] || false}
                         onOpenChange={(isOpen) => setOpenSlaughterDialog(prev => ({ ...prev, [sub.id]: isOpen }))}
                     >
                       <AlertDialogTrigger asChild>
                         <Button
                             variant="outline"
                             size="sm"
                             className="bg-yellow-400 hover:bg-yellow-500 text-black" // Yellow button
                             onClick={() => handleMarkAsSlaughteredClick(sub)}
                         >
                           <Utensils className="ml-2 h-4 w-4" />
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

                  {(sub.slaughterStatus === 'marked_slaughtered' || sub.slaughterStatus === 'confirmed_slaughtered') && (
                      <>
                          <AlertDialog
                              open={openUndoSlaughterDialog[sub.id] || false}
                              onOpenChange={(isOpen) => setOpenUndoSlaughterDialog(prev => ({ ...prev, [sub.id]: isOpen }))}
                          >
                              <AlertDialogTrigger asChild>
                                  <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-green-500 hover:bg-green-600 text-white" // Green button
                                      onClick={() => handleUndoSlaughterClick(sub)}
                                  >
                                      <CheckCircle className="ml-2 h-4 w-4" />
                                      تم الذبح (مؤكد) {/* Changed text for clarity */}
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

                           <Button variant="outline" size="sm" onClick={() => handleSendNotification(sub)}> {/* Added the notification button */}
                              إرسال الإشعار
                          </Button>
                      </>
                  )}

                   {sub.slaughterStatus === 'notified' && (
                        <div className="flex items-center text-green-600">
                           <CheckCircle className="mr-2 h-5 w-5" />
                           تم الذبح والإشعار
                           {sub.slaughterDate && ( // Keep displaying date if available
                             <span className="text-xs text-muted-foreground ml-1">
                               ({format(new Date(sub.slaughterDate), "dd/MM/yy HH:mm", { locale: arSA })})
                             </span>
                           )}
                         </div>
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