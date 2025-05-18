
"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
// Updated icon imports to include ClipboardList and other relevant icons
import { Settings2, TableIcon, BarChart3, HandHelping, Coins, RefreshCw, Loader2, Users, FileText, Sheet, UserPlus, ListChecks, ClipboardList } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useRef } from "react"; // Added useRef
import type { AdahiSubmission, DistributionPreference } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import AdminSubmissionsTable from "@/components/tables/AdminSubmissionsTable";
import { distributionOptions } from "@/lib/types";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
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
  
  const prevSubmissionIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const currentSubmissionIds = new Set(allSubmissionsForAdmin.map(s => s.id));
    let newSubmissionsCount = 0;

    if (prevSubmissionIdsRef.current.size > 0) { // Only check for new if there was a previous state
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
    // Store current IDs before refresh to compare after refresh
    const idsBeforeRefresh = new Set(allSubmissionsForAdmin.map(s => s.id));
    await refreshData();
    // After refresh, allSubmissionsForAdmin will be updated,
    // the useEffect listening to allSubmissionsForAdmin will handle the notification.
    setIsRefreshing(false);
    toast({ title: "تم تحديث البيانات" });
  }, [refreshData, toast]); // Added allSubmissionsForAdmin to dependencies

  useEffect(() => {
    if (!authLoading) {
      if (user && user.isAdmin) {
        if (typeof handleRefresh === 'function') {
            // Initial fetch logic
            if (allSubmissionsForAdmin.length === 0 && pageLoading) { // Fetch if initially empty and page is still loading
                handleRefresh().finally(() => setPageLoading(false));
            } else {
                setPageLoading(false);
                 // Set initial prevSubmissionIdsRef on first load with data
                if (prevSubmissionIdsRef.current.size === 0) {
                    prevSubmissionIdsRef.current = new Set(allSubmissionsForAdmin.map(s => s.id));
                }
            }
        } else {
            setPageLoading(false);
        }
      } else {
        setPageLoading(false);
      }
    }
  }, [authLoading, user, handleRefresh, allSubmissionsForAdmin]);


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
      if (!sub.submitterUsername && sub.userId) {
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
                if (sheet[cell_ref] && sheet[cell_ref].v !== undefined && sheet[cell_ref].v !== null && sheet[cell_ref].v !== "") {
                     sheet[cell_ref].s = {
                        ...(sheet[cell_ref].s || {}),
                         border: {
                            top: { style: "thin", color: { auto: 1 } },
                            bottom: { style: "thin", color: { auto: 1 } },
                            left: { style: "thin", color: { auto: 1 } },
                            right: { style: "thin", color: { auto: 1 } },
                        },
                        alignment: { ...(sheet[cell_ref].s?.alignment || {}), horizontal: "right", vertical: "center", wrapText: true }
                    };
                } else if (sheet[cell_ref]) { 
                     sheet[cell_ref].s = {
                        ...(sheet[cell_ref].s || {}),
                        alignment: { ...(sheet[cell_ref].s?.alignment || {}), horizontal: "right", vertical: "center", wrapText: true }
                     };
                }
            });
        });
        
        const colWidths = columnsToExport.map(column => ({ wch: Math.max(15, String(column.header).length + 5) }));
        sheet['!cols'] = colWidths;
        
        if (sheet['!ref']) {
            const range = XLSX.utils.decode_range(sheet['!ref']);
            if (range.s.r <= headerRowIndex && range.e.r >= headerRowIndex) {
                 sheet['!autofilter'] = { ref: XLSX.utils.encode_range({s: {r: headerRowIndex, c: range.s.c}, e: {r: headerRowIndex, c: range.e.c}}) };
            }
        }
    }
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };
  
  const generatePdfWithHtml2Pdf = async (title: string, data: any[], columns: Array<{header: string, dataKey: string}>, fileName: string) => {
    const currentExportType = fileName.includes('المستخدم') ? 'userPdf' : (fileName.includes('غزة') && !fileName.includes('ما_عدا') ? 'gazaPdf' : (fileName.includes('ما_عدا_غزة') ? 'allExceptGazaPdf' : 'allPdf'));
    setExportingType(currentExportType);
    
    try {
      const exportDateText = `تاريخ التصدير: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ar })}`;
      
      let tableHtml = `<table style="width: 100%; border-collapse: collapse; font-family: 'Amiri', Arial, sans-serif; font-size: 8pt; direction: rtl;">`;
      tableHtml += `<thead><tr>`;
      columns.forEach(col => { // Use the passed 'columns' which might be reversed
        tableHtml += `<th style="border: 1px solid black; padding: 5px; text-align: center; vertical-align: middle; line-height: 1.5; background-color: #eeeeee; font-family: 'Amiri', Arial, sans-serif; font-weight: bold;">${col.header}</th>`;
      });
      tableHtml += `</tr></thead>`;
      tableHtml += `<tbody>`;
      data.forEach(item => {
        tableHtml += `<tr>`;
        columns.forEach(col => { // Use the passed 'columns' for data mapping
          const value = item.hasOwnProperty(col.dataKey) ? item[col.dataKey] : "";
          tableHtml += `<td style="border: 1px solid black; padding: 5px; text-align: center; vertical-align: middle; line-height: 1.5; font-family: 'Amiri', Arial, sans-serif;">${value}</td>`;
        });
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody></table>`;

      const contentHtml = `
        <div style="direction: rtl; text-align: center; font-family: 'Amiri', Arial, sans-serif; margin: ${PDF_MARGIN}mm;">
          <h2 style="text-align: center; font-size: 16pt; font-family: 'Amiri', Arial, sans-serif; font-weight: bold;">${title}</h2>
          <p style="text-align: center; font-size: 12pt; font-family: 'Amiri', Arial, sans-serif;">${exportDateText}</p>
          ${tableHtml}
        </div>
      `;

      const element = document.createElement('div');
      element.innerHTML = contentHtml;
      document.body.appendChild(element);

      const opt = {
        margin: PDF_MARGIN,
        filename: `${fileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: true, dpi: 192, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: `تم تصدير ${fileName} (PDF) بنجاح` });
      document.body.removeChild(element);

    } catch (error) {
      console.error(`Error exporting ${fileName} to PDF:`, error);
      toast({ title: "خطأ في التصدير (PDF)", description: `حدث خطأ أثناء محاولة تصدير ${fileName}.`, variant: "destructive" });
    } finally {
      setExportingType(null);
    }
  };


  const handleExportAllExcel = async () => {
    if (allSubmissionsForAdmin.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    setExportingType('allExcel');
    try {
      const dataToExport = await prepareDataForExport(allSubmissionsForAdmin);
      exportToExcel(dataToExport, "جميع_الأضاحي", "الكل", commonExportColumns);
      toast({ title: "تم تصدير جميع الأضاحي (Excel) بنجاح" });
    } catch (error) {
      console.error("Error exporting all to Excel:", error);
      toast({ title: "خطأ في التصدير (Excel)", description: "حدث خطأ أثناء محاولة تصدير جميع الأضاحي.", variant: "destructive" });
    }
    setExportingType(null);
  };

  const handleExportGazaExcel = async () => {
    const gazaSubmissions = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza');
    if (gazaSubmissions.length === 0) {
      toast({ title: "لا توجد أضاحي لغزة للتصدير" });
      return;
    }
    setExportingType('gazaExcel');
    try {
      const dataToExport = await prepareDataForExport(gazaSubmissions);
      exportToExcel(dataToExport, "أضاحي_غزة", "أهل غزة", commonExportColumns);
      toast({ title: "تم تصدير أضاحي غزة (Excel) بنجاح" });
    } catch (error) {
      console.error("Error exporting Gaza to Excel:", error);
      toast({ title: "خطأ في التصدير (Excel)", description: "حدث خطأ أثناء محاولة تصدير أضاحي غزة.", variant: "destructive" });
    }
    setExportingType(null);
  };
  
  const handleExportAllExceptGazaExcel = async () => {
    const exceptGazaSubmissions = allSubmissionsForAdmin.filter(s => s.distributionPreference !== 'gaza');
    if (exceptGazaSubmissions.length === 0) {
      toast({ title: "لا توجد أضاحي (ما عدا غزة) للتصدير" });
      return;
    }
    setExportingType('allExceptGazaExcel');
    try {
      const dataToExport = await prepareDataForExport(exceptGazaSubmissions);
      exportToExcel(dataToExport, "أضاحي_ما_عدا_غزة", "ما عدا غزة", commonExportColumns);
      toast({ title: "تم تصدير الأضاحي (ما عدا غزة) (Excel) بنجاح" });
    } catch (error) {
      console.error("Error exporting all except Gaza to Excel:", error);
      toast({ title: "خطأ في التصدير (Excel)", description: "حدث خطأ أثناء محاولة تصدير الأضاحي (ما عدا غزة).", variant: "destructive" });
    }
    setExportingType(null);
  };

  const handleExportByUserExcel = async () => {
    if (allSubmissionsForAdmin.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    setExportingType('userExcel');
    try {
      const submissionsByUser: { [key: string]: any[] } = {};
      const allDataPrepared = await prepareDataForExport(allSubmissionsForAdmin);

      allDataPrepared.forEach(subPrepared => {
          let userName = subPrepared.submitterUsername || 'مستخدم_غير_معروف';
          const userKey = userName.replace(/[<>:"/\\|?* [\]]/g, '_').substring(0, 31);

          if (!submissionsByUser[userKey]) {
              submissionsByUser[userKey] = [];
          }
          submissionsByUser[userKey].push(subPrepared);
      });

      for (const userNameKey in submissionsByUser) {
        const userSubmissionsData = submissionsByUser[userNameKey];
        if (userSubmissionsData.length > 0) {
            exportToExcel(userSubmissionsData, `أضاحي_المستخدم_${userNameKey}`, userNameKey, commonExportColumns);
        }
      }
      toast({ title: "تم تصدير الأضاحي حسب المستخدم (ملفات Excel منفصلة) بنجاح" });
    } catch (error) {
      console.error("Error exporting by user to Excel:", error);
      toast({ title: "خطأ في التصدير (Excel)", description: "حدث خطأ أثناء محاولة تصدير الأضاحي حسب المستخدم.", variant: "destructive" });
    }
    setExportingType(null);
  };

  const handleExportAllPdf = async () => {
    if (allSubmissionsForAdmin.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    const dataToExport = await prepareDataForExport(allSubmissionsForAdmin);
    await generatePdfWithHtml2Pdf("تقرير جميع الأضاحي", dataToExport, commonExportColumns, "جميع_الأضاحي");
  };

  const handleExportGazaPdf = async () => {
    const gazaSubmissionsRaw = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza');
    if (gazaSubmissionsRaw.length === 0) {
      toast({ title: "لا توجد أضاحي لغزة للتصدير" });
      return;
    }
    const dataToExport = await prepareDataForExport(gazaSubmissionsRaw);
    await generatePdfWithHtml2Pdf("تقرير أضاحي غزة", dataToExport, commonExportColumns, "أضاحي_غزة");
  };
  
  const handleExportAllExceptGazaPdf = async () => {
    const exceptGazaSubmissions = allSubmissionsForAdmin.filter(s => s.distributionPreference !== 'gaza');
    if (exceptGazaSubmissions.length === 0) {
      toast({ title: "لا توجد أضاحي (ما عدا غزة) للتصدير" });
      return;
    }
    const dataToExport = await prepareDataForExport(exceptGazaSubmissions);
    await generatePdfWithHtml2Pdf("تقرير الأضاحي (ما عدا غزة)", dataToExport, commonExportColumns, "أضاحي_ما_عدا_غزة");
  };

  const handleExportByUserPdf = async () => {
    if (allSubmissionsForAdmin.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    
    try {
      const submissionsByUser: { [key: string]: { data: any[], originalUserName: string } } = {};
      const allDataPrepared = await prepareDataForExport(allSubmissionsForAdmin);

      allDataPrepared.forEach(subPrepared => {
          let originalUserName = subPrepared.submitterUsername || 'مستخدم_غير_معروف';
          const userKey = originalUserName.replace(/[<>:"/\\|?* [\]]/g, '_').substring(0, 30);


          if (!submissionsByUser[userKey]) {
              submissionsByUser[userKey] = { data: [], originalUserName };
          }
          submissionsByUser[userKey].data.push(subPrepared);
      });

      for (const userNameKey in submissionsByUser) {
        const userData = submissionsByUser[userNameKey];
        if (userData.data.length > 0) {
            const pdfTitle = `تقرير أضاحي ${userData.originalUserName}`;
            // Pass commonExportColumns for PDF generation as well
            await generatePdfWithHtml2Pdf(pdfTitle, userData.data, commonExportColumns, `أضاحي_${userNameKey}`);
        }
      }
      toast({ title: "تم تصدير الأضاحي حسب المستخدم (ملفات PDF منفصلة) بنجاح" });
    } catch (error) {
      console.error("Error in by-user PDF export loop:", error);
      toast({ title: "خطأ في التصدير (مجموعة PDF)", description: "حدث خطأ أثناء محاولة تصدير الأضاحي حسب المستخدم.", variant: "destructive" });
    } finally {
        // Moved setExportingType(null) inside the finally block
        // of generatePdfWithHtml2Pdf. For group exports, we only set it to null once all are done.
        // For this specific group export, we should set it at the end of this function.
        setExportingType(null); 
    }
  };


  if (authLoading || pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">جاري تحميل صفحة الإدارة...</p>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <p className="text-destructive text-center">غير مصرح لك بالدخول لهذه الصفحة. يتم توجيهك...</p>
      </div>
    );
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
        <p className="text-sm sm:text-md md:text-lg text-muted-foreground">
          عرض وتعديل وحذف جميع الأضاحي المسجلة في النظام.
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground pt-1">
          إجمالي الأضاحي: {allSubmissionsForAdmin.length} |
          أضاحي للرمثا والمتبرعين: {ramthaAndDonorSubmissionsCount} |
          لأهل غزة: {gazaSubmissionsCount} |
          لصندوق التضامن: {fundSubmissionsCount}
        </p>
      </header>

      <section aria-labelledby="admin-actions" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-md sm:text-lg">إجراءات إدارية</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-xs sm:text-sm">
                  <UserPlus className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                  إنشاء حساب مستخدم جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>إنشاء حساب مستخدم جديد</DialogTitle>
                  <DialogDescription>
                    أدخل بيانات المستخدم الجديد. سيتمكن المستخدم من تسجيل الدخول بهذه البيانات.
                  </DialogDescription>
                </DialogHeader>
                <RegisterForm />
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="text-xs sm:text-sm" asChild>
              <Link href="/dashboard" className="flex items-center">
                <ListChecks className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                الانتقال إلى صفحة إدخال الأضاحي
              </Link>
            </Button>
            <Button variant="outline" className="text-xs sm:text-sm" asChild>
              <Link href="/slaughter" className="flex items-center">
                <ClipboardList className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                إدارة ذبح الأضاحي
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="stats-heading" className="grid gap-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">إجمالي الأضاحي</CardTitle>
            <TableIcon className="h-4 w-4 text-muted-foreground" data-ai-hint="table stats" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl md:text-2xl font-bold">{allSubmissionsForAdmin.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">أضاحي للرمثا والمتبرعين</CardTitle>
            <HandHelping className="h-4 w-4 text-muted-foreground" data-ai-hint="charity giving" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl md:text-2xl font-bold">{ramthaAndDonorSubmissionsCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">أضاحي لأهل غزة</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" data-ai-hint="analytics chart" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl md:text-2xl font-bold">{gazaSubmissionsCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">لصندوق التضامن</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" data-ai-hint="donation fund" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl md:text-2xl font-bold">{fundSubmissionsCount}</div>
          </CardContent>
        </Card>
      </section>

      <div className="space-y-3 md:space-y-4">
        <h2 className="text-md sm:text-lg md:text-xl font-semibold text-center md:text-right">خيارات التصدير وجدول الإدخالات</h2>
        
        <div className="p-2 md:p-3 border rounded-md bg-card shadow-sm space-y-3">
            <div className="flex justify-center">
                 <Button onClick={handleRefresh} variant="outline" disabled={exportingType !== null || authLoading || isRefreshing} className="text-xs sm:text-sm">
                    {isRefreshing ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <RefreshCw className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    تحديث البيانات
                 </Button>
            </div>

            {/* PDF Export Buttons Row */}
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                <Button onClick={handleExportAllPdf} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 text-xs sm:text-sm">
                    {exportingType === 'allPdf' ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <FileText className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    الكل (PDF)
                </Button>
                <Button onClick={handleExportGazaPdf} variant="outline" disabled={exportingType !== null || gazaSubmissionsCount === 0} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 text-xs sm:text-sm">
                    {exportingType === 'gazaPdf' ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <FileText className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    غزة فقط (PDF)
                </Button>
                <Button onClick={handleExportAllExceptGazaPdf} variant="outline" disabled={exportingType !== null || allExceptGazaSubmissionsCount === 0} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 text-xs sm:text-sm">
                    {exportingType === 'allExceptGazaPdf' ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <FileText className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    الكل ما عدا غزة (PDF)
                </Button>
                <Button onClick={handleExportByUserPdf} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 text-xs sm:text-sm">
                    {exportingType === 'userPdf' ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <FileText className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    حسب المستخدم (PDF)
                </Button>
            </div>

            {/* Excel Export Buttons Row */}
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                <Button onClick={handleExportAllExcel} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0} className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 text-xs sm:text-sm">
                    {exportingType === 'allExcel' ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Sheet className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    الكل (Excel)
                </Button>
                <Button onClick={handleExportGazaExcel} variant="outline" disabled={exportingType !== null || gazaSubmissionsCount === 0} className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 text-xs sm:text-sm">
                    {exportingType === 'gazaExcel' ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Sheet className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    غزة فقط (Excel)
                </Button>
                <Button onClick={handleExportAllExceptGazaExcel} variant="outline" disabled={exportingType !== null || allExceptGazaSubmissionsCount === 0} className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 text-xs sm:text-sm">
                    {exportingType === 'allExceptGazaExcel' ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Sheet className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    الكل ما عدا غزة (Excel)
                </Button>
                <Button onClick={handleExportByUserExcel} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0} className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 text-xs sm:text-sm">
                    {exportingType === 'userExcel' ? <Loader2 className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Users className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />}
                    حسب المستخدم (Excel)
                </Button>
            </div>
        </div>
      </div>

      <AdminSubmissionsTable submissions={allSubmissionsForAdmin} onDataChange={handleRefresh} />
    </div>
  );
}

export default AdminPage;
    

    