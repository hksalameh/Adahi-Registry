"use client";

// --- الإضافات الجديدة لإدارة المستخدمين ---
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { UserCog, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";
// ------------------------------------------

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Settings2, TableIcon, BarChart3, Coins, RefreshCw, Loader2, Users, FileText, Sheet, UserPlus, ListChecks, ClipboardList, HandHelping } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useRef } from "react"; 
import type { AdahiSubmission, DistributionPreference } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import AdminSubmissionsTable from "@/components/tables/AdminSubmissionsTable";
import { distributionOptions } from "@/lib/types";
import * as XLSX from 'xlsx';
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import RegisterForm from "@/components/auth/RegisterForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import html2pdf from 'html2pdf.js';

const PDF_MARGIN = 10; // Margin in mm for html2pdf

const AdminPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, user, fetchUserById } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  
  // --- منطق إدارة المستخدمين المدمج ---
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserList, setShowUserList] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersList(users);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
    setLoadingUsers(false);
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    if (confirm("هل تريد تغيير صلاحيات هذا المستخدم؟")) {
      try {
        await updateDoc(doc(db, "users", userId), { isAdmin: !currentStatus, role: !currentStatus ? 'admin' : 'user' });
        fetchUsers();
        toast({ title: "تم تحديث الصلاحيات" });
      } catch (e) {
        toast({ title: "خطأ في التحديث", variant: "destructive" });
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("سيتم حذف صلاحية الدخول لهذا المستخدم، هل أنت متأكد؟")) {
      try {
        await deleteDoc(doc(db, "users", userId));
        fetchUsers();
        toast({ title: "تم حذف المستخدم من القائمة" });
      } catch (e) {
        toast({ title: "خطأ في الحذف", variant: "destructive" });
      }
    }
  };

  useEffect(() => {
    if (isRegisterDialogOpen) {
      fetchUsers();
      setShowUserList(true);
    }
  }, [isRegisterDialogOpen]);
  // ---------------------------------------

  const prevSubmissionIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const currentSubmissionIds = new Set(allSubmissionsForAdmin.map(s => s.id));
    let newSubmissionsCount = 0;

    if (prevSubmissionIdsRef.current.size > 0) { 
      currentSubmissionIds.forEach(id => {
        if (!prevSubmissionIdsRef.current.has(id)) {
          newSubmissionsCount++;
        }
      });

      if (newSubmissionsCount > 0) {
        toast({
          title: "تنبيه إداري",
          description: `تم إضافة ${newSubmissionsCount} أضحية جديدة.`,
        });
      }
    }
    prevSubmissionIdsRef.current = currentSubmissionIds;
  }, [allSubmissionsForAdmin, toast]);

  const getDistributionLabel = useCallback((value?: DistributionPreference | string) => {
    if (!value) return "غير محدد";
    return distributionOptions.find(opt => opt.value === value)?.label || String(value);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
    toast({ title: "تم تحديث البيانات" });
  }, [refreshData, toast, setIsRefreshing]); 

  useEffect(() => {
    if (!authLoading) {
      setPageLoading(false); 
      if (user && user.isAdmin && prevSubmissionIdsRef.current.size === 0 && allSubmissionsForAdmin.length > 0) {
        prevSubmissionIdsRef.current = new Set(allSubmissionsForAdmin.map(s => s.id));
      }
    }
  }, [authLoading, user, allSubmissionsForAdmin]);

  const commonExportColumns = [
    { header: "م", dataKey: "serial" },
    { header: "اسم المتبرع", dataKey: "donorName" },
    { header: "الاضحية باسم", dataKey: "sacrificeFor" },
    { header: "رقم التلفون", dataKey: "phoneNumber" },
    { header: "يريد الحضور", dataKey: "wantsToAttendText" },
    { header: "يريد من الأضحية", dataKey: "wantsFromSacrificeText" },
    { header: "ماذا يريد", dataKey: "sacrificeWishes" },
    { header: "اسم المستخدم", dataKey: "submitterUsername"},
    { header: "تم الدفع", dataKey: "paymentConfirmedText" },
    { header: "عن طريق وسيط", dataKey: "throughIntermediaryText"},
    { header: "اسم الوسيط", dataKey: "intermediaryName"},
    { header: "توزع لـ", dataKey: "distributionPreferenceText" },
  ];
  

  const prepareDataForExport = useCallback(async (submissions: AdahiSubmission[]): Promise<any[]> => {
    const prepared = [];
    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];
      let submitterUsername = sub.submitterUsername || sub.userEmail || "غير معروف";
      if (!sub.submitterUsername && sub.userId && typeof fetchUserById === 'function') {
        try {
            const submitterProfile = await fetchUserById(sub.userId);
            if (submitterProfile && submitterProfile.username) {
            submitterUsername = submitterProfile.username;
            }
        } catch (e) {
            console.error("Error fetching submitter profile for export:", e);
        }
      }
      prepared.push({
        serial: i + 1,
        donorName: sub.donorName,
        sacrificeFor: sub.sacrificeFor,
        phoneNumber: sub.phoneNumber,
        submitterUsername: submitterUsername,
        wantsToAttendText: sub.wantsToAttend ? "نعم" : "لا",
        wantsFromSacrificeText: sub.wantsFromSacrifice ? "نعم" : "لا",
        sacrificeWishes: sub.wantsFromSacrifice ? (sub.sacrificeWishes || "-") : "-",
        paymentConfirmedText: sub.paymentConfirmed ? "نعم" : "لا",
        throughIntermediaryText: sub.throughIntermediary ? "نعم" : "لا",
        intermediaryName: sub.throughIntermediary ? (sub.intermediaryName || "-") : "-",
        distributionPreferenceText: getDistributionLabel(sub.distributionPreference),
        submissionDateFormatted: sub.submissionDate ? format(new Date(sub.submissionDate), "dd/MM/yyyy HH:mm", { locale: ar }) : 'N/A',
        statusText: sub.status === "entered" ? "مدخلة" : "غير مدخلة",
        userId: sub.userId,
        id: sub.id
      });
    }
    return prepared;
  }, [getDistributionLabel, fetchUserById]);

  const exportToExcel = (dataToExportRaw: any[], fileName: string, sheetName: string, columnsToExport: Array<{header: string, dataKey: string}>) => {
    const worksheetData = dataToExportRaw.map(item => {
      const orderedItem: any = {};
      columnsToExport.forEach(col => {
        orderedItem[col.header] = item.hasOwnProperty(col.dataKey) ? item[col.dataKey] : "";
      });
      return orderedItem;
    });

    const ws = XLSX.utils.json_to_sheet(worksheetData, {
      header: columnsToExport.map(col => col.header)
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    if (wb.Sheets[sheetName]) {
        const sheet = wb.Sheets[sheetName];
        sheet['!props'] = { rtl: true }; 
        const headerRowIndex = 0;
        columnsToExport.forEach((_col, C_idx) => {
            const header_cell_ref = XLSX.utils.encode_cell({ r: headerRowIndex, c: C_idx });
            if (sheet[header_cell_ref]) {
                sheet[header_cell_ref].s = {
                    border: {
                        top: { style: "thin", color: { auto: 1 } },
                        bottom: { style: "thin", color: { auto: 1 } },
                        left: { style: "thin", color: { auto: 1 } },
                        right: { style: "thin", color: { auto: 1 } },
                    },
                    alignment: { horizontal: "center", vertical: "center", wrapText: true },
                    font: { bold: true }
                };
            }
        });
        worksheetData.forEach((_row, R_idx) => {
            columnsToExport.forEach((_col, C_idx) => {
                const cell_ref = XLSX.utils.encode_cell({ r: R_idx + 1, c: C_idx });
                if (sheet[cell_ref]) {
                     sheet[cell_ref].s = {
                         border: {
                            top: { style: "thin", color: { auto: 1 } },
                            bottom: { style: "thin", color: { auto: 1 } },
                            left: { style: "thin", color: { auto: 1 } },
                            right: { style: "thin", color: { auto: 1 } },
                        },
                        alignment: { horizontal: "right", vertical: "center", wrapText: true }
                    };
                }
            });
        });
        sheet['!cols'] = columnsToExport.map(() => ({ wch: 18 }));
    }
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };
  
  const generatePdfWithHtml2Pdf = async (title: string, data: any[], columns: Array<{header: string, dataKey: string}>, fileName: string, currentUserName?: string) => {
    const currentExportType = currentUserName ? 'userPdf' : (fileName.includes('غزة') && !fileName.includes('ما_عدا') ? 'gazaPdf' : (fileName.includes('ما_عدا_غزة') ? 'allExceptGazaPdf' : 'allPdf'));
    setExportingType(currentExportType);
    
    try {
      const exportDateText = `تاريخ التصدير: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ar })}`;
      const reportTitle = currentUserName ? `تقرير أضاحي ${currentUserName}` : title;
      let tableHtml = `<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 8pt; direction: rtl;">`;
      tableHtml += `<thead><tr>`;
      columns.forEach(col => { tableHtml += `<th style="border: 1px solid black; padding: 5px; text-align: center; background-color: #eeeeee; font-weight: bold;">${col.header}</th>`; });
      tableHtml += `</tr></thead><tbody>`;
      data.forEach(item => {
        tableHtml += `<tr>`;
        columns.forEach(col => { tableHtml += `<td style="border: 1px solid black; padding: 5px; text-align: center;">${item[col.dataKey] || ""}</td>`; });
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody></table>`;
      const element = document.createElement('div');
      element.innerHTML = `<div style="direction: rtl; text-align: center; margin: 10mm;"><h2>${reportTitle}</h2><p>${exportDateText}</p>${tableHtml}</div>`;
      const opt = { margin: 10, filename: `${fileName}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
      await html2pdf().from(element).set(opt).save();
      toast({ title: `تم تصدير ${fileName} بنجاح` });
    } catch (error) {
      toast({ title: "خطأ في التصدير (PDF)", variant: "destructive" });
    } finally { setExportingType(null); }
  };

  const handleExportAllExcel = async () => {
    setExportingType('allExcel');
    const data = await prepareDataForExport(allSubmissionsForAdmin);
    exportToExcel(data, "جميع_الأضاحي", "الكل", commonExportColumns);
    setExportingType(null);
  };

  const handleExportGazaExcel = async () => {
    const gazaSubmissions = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza');
    setExportingType('gazaExcel');
    const data = await prepareDataForExport(gazaSubmissions);
    exportToExcel(data, "أضاحي_غزة", "أهل غزة", commonExportColumns);
    setExportingType(null);
  };
  
  const handleExportAllExceptGazaExcel = async () => {
    const submissions = allSubmissionsForAdmin.filter(s => s.distributionPreference !== 'gaza');
    setExportingType('allExceptGazaExcel');
    const data = await prepareDataForExport(submissions);
    exportToExcel(data, "أضاحي_ما_عدا_غزة", "ما عدا غزة", commonExportColumns);
    setExportingType(null);
  };

  const handleExportByUserExcel = async () => {
    setExportingType('userExcel');
    const allDataPrepared = await prepareDataForExport(allSubmissionsForAdmin);
    const submissionsByUser: { [key: string]: any[] } = {};
    allDataPrepared.forEach(sub => {
      let userName = sub.submitterUsername || 'مستخدم_غير_معروف';
      const userKey = userName.replace(/[<>:"/\\|?* [\]]/g, '_').substring(0, 31);
      if (!submissionsByUser[userKey]) submissionsByUser[userKey] = [];
      submissionsByUser[userKey].push(sub);
    });
    for (const key in submissionsByUser) {
      exportToExcel(submissionsByUser[key], `أضاحي_المستخدم_${key}`, key, commonExportColumns);
    }
    setExportingType(null);
  };

  const handleExportAllPdf = async () => {
    const data = await prepareDataForExport(allSubmissionsForAdmin);
    await generatePdfWithHtml2Pdf("تقرير جميع الأضاحي", data, commonExportColumns, "جميع_الأضاحي");
  };

  const handleExportGazaPdf = async () => {
    const gazaSubmissions = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza');
    const data = await prepareDataForExport(gazaSubmissions);
    await generatePdfWithHtml2Pdf("تقرير أضاحي غزة", data, commonExportColumns, "أضاحي_غزة");
  };
  
  const handleExportAllExceptGazaPdf = async () => {
    const submissions = allSubmissionsForAdmin.filter(s => s.distributionPreference !== 'gaza');
    const data = await prepareDataForExport(submissions);
    await generatePdfWithHtml2Pdf("تقرير الأضاحي (ما عدا غزة)", data, commonExportColumns, "أضاحي_ما_عدا_غزة");
  };

  const handleExportByUserPdf = async () => {
    const allDataPrepared = await prepareDataForExport(allSubmissionsForAdmin);
    const submissionsByUser: { [key: string]: { data: any[], name: string } } = {};
    allDataPrepared.forEach(sub => {
      let name = sub.submitterUsername || 'مستخدم_غير_معروف';
      const userKey = name.replace(/[<>:"/\\|?* [\]]/g, '_').substring(0, 30);
      if (!submissionsByUser[userKey]) submissionsByUser[userKey] = { data: [], name };
      submissionsByUser[userKey].data.push(sub);
    });
    for (const key in submissionsByUser) {
      await generatePdfWithHtml2Pdf(`تقرير أضاحي ${submissionsByUser[key].name}`, submissionsByUser[key].data, commonExportColumns, `أضاحي_${key}`, submissionsByUser[key].name);
    }
  };

  const handleRegisterFormSubmit = () => { setIsRegisterDialogOpen(false); };

  if (authLoading || pageLoading) {
    return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="mt-4 text-muted-foreground">جاري تحميل صفحة الإدارة...</p></div>;
  }

  if (!user || !user.isAdmin) {
    return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><p className="text-destructive text-center">غير مصرح لك بالدخول لهذه الصفحة.</p></div>;
  }

  const gazaSubmissionsCount = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza').length;
  const ramthaAndDonorSubmissionsCount = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'ramtha' || s.distributionPreference === 'donor').length;
  const fundSubmissionsCount = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'fund').length;
  const allExceptGazaSubmissionsCount = allSubmissionsForAdmin.filter(s => s.distributionPreference !== 'gaza').length;

  return (
    <div className="space-y-6 md:space-y-8 p-1">
      <header className="space-y-2 pb-4 md:pb-6 border-b">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-5 w-5 sm:h-6 sm:w-7 md:h-8 md:w-8 text-primary" />
          إدارة الأضاحي
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground pt-1">
          إجمالي الأضاحي: {allSubmissionsForAdmin.length} | أضاحي للرمثا: {ramthaAndDonorSubmissionsCount} | لأهل غزة: {gazaSubmissionsCount} | لصندوق التضامن: {fundSubmissionsCount}
        </p>
      </header>

      <section className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-md sm:text-lg">إجراءات إدارية</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-xs sm:text-sm bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                  <UserCog className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> إدارة المستخدمين
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>{showUserList ? "قائمة المستخدمين" : "إنشاء حساب جديد"}</DialogTitle>
                  <DialogDescription>{showUserList ? "تعديل صلاحيات أو حذف المستخدمين." : "أدخل بيانات المستخدم الجديد."}</DialogDescription>
                </DialogHeader>
                <div className="flex justify-center gap-4 mb-4 border-b pb-2">
                  <Button variant={showUserList ? "default" : "ghost"} size="sm" onClick={() => setShowUserList(true)}>قائمة المستخدمين</Button>
                  <Button variant={!showUserList ? "default" : "ghost"} size="sm" onClick={() => setShowUserList(false)}>إضافة مستخدم</Button>
                </div>
                {showUserList ? (
                  <div className="space-y-4">
                    {loadingUsers ? <div className="text-center p-4 text-xs">جاري التحميل...</div> : (
                      <div className="divide-y">
                        {usersList.map((u) => (
                          <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                            <div className="text-right">
                              <p className="font-bold text-sm">{u.username || "بدون اسم"}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="icon" variant="ghost" title={u.isAdmin ? "سحب صلاحية" : "جعل أدمن"} onClick={() => toggleAdminStatus(u.id, u.isAdmin)}>
                                {u.isAdmin ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <ShieldAlert className="h-4 w-4 text-gray-400" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDeleteUser(u.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : <RegisterForm isAdminCreator={true} onFormSubmit={handleRegisterFormSubmit} />}
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="text-xs sm:text-sm" asChild><Link href="/dashboard"><ListChecks className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> إدخال الأضاحي</Link></Button>
            <Button variant="outline" className="text-xs sm:text-sm" asChild><Link href="/slaughter"><ClipboardList className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> إدارة ذبح الأضاحي</Link></Button>
          </CardContent>
        </Card>
      </section>

      {/* --- إرجاع قسم الإحصائيات الأصلي كاملاً --- */}
      <section className="grid gap-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">إجمالي الأضاحي</CardTitle>
            <TableIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg sm:text-xl md:text-2xl font-bold">{allSubmissionsForAdmin.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">أضاحي للرمثا</CardTitle>
            <HandHelping className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg sm:text-xl md:text-2xl font-bold">{ramthaAndDonorSubmissionsCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">أضاحي لأهل غزة</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg sm:text-xl md:text-2xl font-bold">{gazaSubmissionsCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">لصندوق التضامن</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg sm:text-xl md:text-2xl font-bold">{fundSubmissionsCount}</div></CardContent>
        </Card>
      </section>

      {/* --- إرجاع قسم التصدير الأصلي بكامل تنسيقاته --- */}
      <div className="space-y-3 md:space-y-4">
        <h2 className="text-md sm:text-lg md:text-xl font-semibold text-center md:text-right">خيارات التصدير وجدول الإدخالات</h2>
        <div className="p-2 md:p-3 border rounded-md bg-card shadow-sm space-y-3">
            <div className="flex justify-center">
                 <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing} className="text-xs sm:text-sm">
                    {isRefreshing ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <RefreshCw className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    تحديث البيانات
                 </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                <Button onClick={handleExportAllPdf} variant="outline" className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 text-xs sm:text-sm">
                    <FileText className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> الكل (PDF)
                </Button>
                <Button onClick={handleExportGazaPdf} variant="outline" className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 text-xs sm:text-sm">
                    <FileText className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> غزة (PDF)
                </Button>
                <Button onClick={handleExportAllExceptGazaPdf} variant="outline" className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 text-xs sm:text-sm">
                    <FileText className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> ما عدا غزة (PDF)
                </Button>
                <Button onClick={handleExportByUserPdf} variant="outline" className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 text-xs sm:text-sm">
                    <FileText className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> حسب المستخدم (PDF)
                </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                <Button onClick={handleExportAllExcel} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 text-xs sm:text-sm">
                    <Sheet className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> الكل (Excel)
                </Button>
                <Button onClick={handleExportGazaExcel} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 text-xs sm:text-sm">
                    <Sheet className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> غزة (Excel)
                </Button>
                <Button onClick={handleExportAllExceptGazaExcel} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 text-xs sm:text-sm">
                    <Sheet className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> ما عدا غزة (Excel)
                </Button>
                <Button onClick={handleExportByUserExcel} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 text-xs sm:text-sm">
                    <Users className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" /> حسب المستخدم (Excel)
                </Button>
            </div>
        </div>
      </div>

      <AdminSubmissionsTable submissions={allSubmissionsForAdmin} onDataChange={handleRefresh} />
    </div>
  );
}

export default AdminPage;
