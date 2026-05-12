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
import { cn } from "@/lib/utils"; 
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SlaughterPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, user, sendSlaughterNotification, updateSubmission: updateSubmissionStatusInAuth } = useAuth(); 
  const { toast } = useToast(); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [submissionsToDisplay, setSubmissionsToDisplay] = useState<AdahiSubmission[]>([]);
  const [openSlaughterDialog, setOpenSlaughterDialog] = useState<Record<string, boolean>>({});
  const [openUndoSlaughterDialog, setOpenUndoSlaughterDialog] = useState<Record<string, boolean>>({});
  
  // الحالة الجديدة لفتح بطاقة تفاصيل المتبرع من الأسفل
  const [selectedSubForDrawer, setSelectedSubForDrawer] = useState<AdahiSubmission | null>(null);

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
    const sortedSubmissions = [...allSubmissionsForAdmin].sort((a, b) => {
      const aIsDone = a.slaughterStatus === 'notified' || a.slaughterStatus === 'confirmed_slaughtered' || a.isSlaughtered;
      const bIsDone = b.slaughterStatus === 'notified' || b.slaughterStatus === 'confirmed_slaughtered' || b.isSlaughtered;
      if (aIsDone && !bIsDone) return 1; 
      if (!aIsDone && bIsDone) return -1; 
      const dateA = a.submissionDate ? new Date(a.submissionDate).getTime() : 0;
      const dateB = b.submissionDate ? new Date(b.submissionDate).getTime() : 0;
      return dateB - dateA; 
    });
    setSubmissionsToDisplay(sortedSubmissions);
  }, [allSubmissionsForAdmin]);

  const updateSubmissionSlaughterStatus = async (submissionId: string, newStatus: AdahiSubmission['slaughterStatus'], isSlaughteredFlag?: boolean) => {
      const updatePayload: Partial<AdahiSubmission> = { slaughterStatus: newStatus };
      if (isSlaughteredFlag !== undefined) {
        updatePayload.isSlaughtered = isSlaughteredFlag;
        if (isSlaughteredFlag && newStatus !== 'pending') { 
            updatePayload.slaughterDate = new Date().toISOString();
        } else if (!isSlaughteredFlag && newStatus === 'pending') { 
            updatePayload.slaughterDate = null; 
        }
      }

      const success = await updateSubmissionStatusInAuth(submissionId, updatePayload);

       if (success) {
           toast({ title: `تم تحديث حالة الأضحية بنجاح` });
           await refreshData(); 
       } else {
           toast({ title: `فشل تحديث حالة الأضحية`, variant: "destructive" });
       }
  };


  const handleMarkAsSlaughteredClick = (submission: AdahiSubmission) => {
      setOpenSlaughterDialog(prev => ({ ...prev, [submission.id]: true }));
  };

  const handleConfirmMarkAsSlaughtered = async (submissionId: string) => {
      await updateSubmissionSlaughterStatus(submissionId, 'confirmed_slaughtered', true); 
      setOpenSlaughterDialog(prev => ({ ...prev, [submissionId]: false }));
  };

   const handleUndoSlaughterClick = (submission: AdahiSubmission) => {
       setOpenUndoSlaughterDialog(prev => ({ ...prev, [submission.id]: true }));
   };

   const handleConfirmUndoSlaughter = async (submission: AdahiSubmission) => {
        await updateSubmissionSlaughterStatus(submission.id, 'pending', false); 
        setOpenUndoSlaughterDialog(prev => ({ ...prev, [submission.id]: false }));
   };

   const handleSendNotification = async (submission: AdahiSubmission) => {
       toast({ title: "جاري فتح وسيلة الإرسال..." });
       const notificationSuccess = await sendSlaughterNotification(submission.id, submission.donorName, submission.phoneNumber);
       if (notificationSuccess) {
            await refreshData();
       }
   };

  const renderSubmissionTable = (currentSubmissions: AdahiSubmission[]) => {
    if (currentSubmissions.length === 0) {
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
              <TableHead>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentSubmissions.map((sub, index) => { 
              const isActuallySlaughtered = sub.isSlaughtered || sub.slaughterStatus === 'confirmed_slaughtered' || sub.slaughterStatus === 'notified';
              return (
              <TableRow 
                key={sub.id}
                className={cn(
                    isActuallySlaughtered ? "bg-red-100/50 dark:bg-red-900/30" :
                    sub.wantsToAttend ? "bg-blue-100 dark:bg-blue-900/30" :
                    (sub.paymentConfirmed ? "bg-yellow-50 dark:bg-yellow-900/20" : "")
                )}
              >
                <TableCell>{index + 1}</TableCell>
                <TableCell 
                  className="cursor-pointer font-bold text-blue-700 underline decoration-dotted hover:text-blue-900" 
                  onClick={() => setSelectedSubForDrawer(sub)}
                >
                  {sub.donorName}
                </TableCell>
                <TableCell>{sub.sacrificeFor}</TableCell>
                <TableCell>{sub.phoneNumber}</TableCell>
                <TableCell>{sub.wantsToAttend ? "نعم" : "لا"}</TableCell>
                <TableCell>{sub.wantsFromSacrifice ? "نعم" : "لا"}</TableCell>
                <TableCell>{sub.wantsFromSacrifice ? (sub.sacrificeWishes || "-") : "-"}</TableCell>
                <TableCell>{getDistributionLabel(sub.distributionPreference)}</TableCell>
                <TableCell>
                  <Badge className={sub.status === "entered" ? "bg-green-500 text-white" : "bg-yellow-400 text-black"}>
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
                         <Button variant="outline" size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-black text-xs" onClick={() => handleMarkAsSlaughteredClick(sub)}>
                           <Utensils className="ml-1 h-3 w-3" /> تم الذبح
                         </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>تأكيد عملية الذبح</AlertDialogTitle>
                           <AlertDialogDescription>هل أنت متأكد من تسجيل ذبح أضحية: {sub.donorName}؟</AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>إلغاء</AlertDialogCancel>
                           <AlertDialogAction onClick={() => handleConfirmMarkAsSlaughtered(sub.id)}>نعم، تم الذبح</AlertDialogAction>
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
                                  <Button variant="outline" size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => handleUndoSlaughterClick(sub)}>
                                      <CheckCircle className="ml-1 h-3 w-3" /> تم الذبح
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>التراجع عن تسجيل الذبح</AlertDialogTitle>
                                      <AlertDialogDescription>هل تريد إعادة أضحية {sub.donorName} للحالة السابقة؟</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleConfirmUndoSlaughter(sub)}>نعم، تراجع</AlertDialogAction>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                           <Button variant="outline" size="sm" onClick={() => handleSendNotification(sub)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs">
                              <Send className="ml-1 h-3 w-3" /> إرسال إشعار
                          </Button>
                      </>
                  )}

                   {sub.slaughterStatus === 'notified' && (
                        <div className="flex items-center text-green-700 font-semibold text-xs whitespace-nowrap">
                           <CheckCircle className="mr-1 h-4 w-4" /> تم وأُشعر
                           {sub.slaughterDate && <span className="text-muted-foreground ml-1">({format(new Date(sub.slaughterDate), "dd/MM HH:mm", { locale: arSA })})</span>}
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
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">جاري تحميل صفحة إدارة الذبح...</p>
      </div>
    );
  }

  const ramthaAndDonorSubmissions = submissionsToDisplay.filter(s => s.distributionPreference === "ramtha" || s.distributionPreference === "donor");
  const gazaSubmissions = submissionsToDisplay.filter(s => s.distributionPreference === "gaza");
  const fundSubmissions = submissionsToDisplay.filter(s => s.distributionPreference === "fund");

  return (
    <div className="space-y-8 p-2">
      <header className="space-y-2 pb-6 border-b text-center md:text-right">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-center md:justify-start gap-2">
          <Utensils className="h-7 w-7 text-primary" /> إدارة ذبح الأضاحي
        </h1>
        <p className="text-muted-foreground">تتبع وسجل عملية ذبح الأضاحي بشكل سريع ومبسط.</p>
        <div className="flex justify-center pt-4">
          <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />} تحديث البيانات
          </Button>
        </div>
      </header>

      <Card><CardHeader><CardTitle>أضاحي داخل الرمثا وللمتبرعين</CardTitle></CardHeader><CardContent>{renderSubmissionTable(ramthaAndDonorSubmissions)}</CardContent></Card>
      <Card><CardHeader><CardTitle>أضاحي لأهل غزة</CardTitle></CardHeader><CardContent>{renderSubmissionTable(gazaSubmissions)}</CardContent></Card>
      <Card><CardHeader><CardTitle>أضاحي لصندوق التكافل والتضامن</CardTitle></CardHeader><CardContent>{renderSubmissionTable(fundSubmissions)}</CardContent></Card>

      {/* بطاقة التفاصيل السريعة للمسلخ (Bottom Sheet) */}
      <Dialog open={!!selectedSubForDrawer} onOpenChange={() => setSelectedSubForDrawer(null)}>
        <DialogContent className="sm:max-w-[450px] border-t-8 border-t-green-500 rounded-t-3xl fixed bottom-0 top-auto translate-y-0 duration-300 bg-white p-6" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-primary border-b pb-2">تفاصيل الأضحية</DialogTitle>
          </DialogHeader>
          
          {selectedSubForDrawer && (
            <div className="space-y-6 py-4">
              <div className="text-right">
                <span className="text-muted-foreground text-xs block">اسم المتبرع:</span>
                <span className="text-3xl font-bold block">{selectedSubForDrawer.donorName}</span>
              </div>

              <div className="text-right">
                <span className="text-muted-foreground text-xs block">الأضحية عن:</span>
                <span className="text-2xl font-semibold text-blue-600 block">{selectedSubForDrawer.sacrificeFor}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={cn("p-3 rounded-xl border-2 text-center", selectedSubForDrawer.wantsToAttend ? "border-blue-500 bg-blue-50" : "border-gray-200")}>
                  <span className="block text-[10px] text-muted-foreground uppercase">الحضور؟</span>
                  <span className="text-lg font-bold">{selectedSubForDrawer.wantsToAttend ? "✅ سيحضر" : "❌ لن يحضر"}</span>
                </div>
                <div className={cn("p-3 rounded-xl border-2 text-center", selectedSubForDrawer.wantsFromSacrifice ? "border-orange-500 bg-orange-50" : "border-gray-200")}>
                  <span className="block text-[10px] text-muted-foreground uppercase">يريد منها؟</span>
                  <span className="text-lg font-bold">{selectedSubForDrawer.wantsFromSacrifice ? "✅ نعم" : "❌ لا"}</span>
                </div>
              </div>

              {selectedSubForDrawer.wantsFromSacrifice && (
                <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-right">
                  <span className="text-xs text-yellow-700 font-bold block mb-1 underline">ماذا يريد من الأضحية:</span>
                  <span className="text-xl font-bold text-gray-800 leading-relaxed">{selectedSubForDrawer.sacrificeWishes || "لم يتم تحديد تفاصيل"}</span>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button 
                  className="flex-1 h-16 text-xl font-black bg-green-600 hover:bg-green-700 shadow-lg text-white"
                  onClick={() => {
                    handleConfirmMarkAsSlaughtered(selectedSubForDrawer.id);
                    setSelectedSubForDrawer(null);
                  }}
                >
                  تأكيد الذبح
                </Button>
                <Button variant="outline" className="w-24 h-16 text-lg border-2" onClick={() => setSelectedSubForDrawer(null)}>إغلاق</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SlaughterPage;
