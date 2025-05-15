
"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { FileDown, Settings2, TableIcon, BarChart3, HandHelping, Coins, RefreshCw, Loader2, Users, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import type { AdahiSubmission, DistributionPreference } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import AdminSubmissionsTable from "@/components/tables/AdminSubmissionsTable";
import { distributionOptions } from "@/lib/types";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from "date-fns";
import { ar } from "date-fns/locale";

// Extend jsPDF interface for jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    addFileToVFS: (fileName: string, data: string) => jsPDF;
    addFont: (postScriptName: string, fontName: string, fontStyle: string, fontWeight?: string | number, encoding?: string) => jsPDF;
  }
}

const AdminPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, user, fetchUserById } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [amiriFontBase64, setAmiriFontBase64] = useState<string | null>(null);
  const [fontLoadedSuccessfully, setFontLoadedSuccessfully] = useState<boolean>(false);

  const PDF_MARGIN = 40;

  const getDistributionLabel = useCallback((value?: DistributionPreference | string) => {
    if (!value) return "غير محدد";
    return distributionOptions.find(opt => opt.value === value)?.label || String(value);
  }, []);

  useEffect(() => {
    const loadFont = async () => {
      try {
        const response = await fetch('/fonts/Amiri-Regular.ttf');
        if (!response.ok) {
          throw new Error('Failed to fetch Amiri font. Ensure Amiri-Regular.ttf is in public/fonts/');
        }
        const fontBlob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAmiriFontBase64(base64data.split(',')[1]);
          setFontLoadedSuccessfully(true);
          console.log("Amiri font loaded successfully for PDF generation.");
        };
        reader.onerror = (error) => {
          console.error("Error reading font blob:", error);
          setFontLoadedSuccessfully(false);
          throw new Error("Failed to read font blob.");
        };
        reader.readAsDataURL(fontBlob);
      } catch (error: any) {
        console.error("Error loading Amiri font:", error.message);
        setFontLoadedSuccessfully(false);
        toast({
          title: "خطأ في تحميل الخط لملفات PDF",
          description: `لم يتم تحميل خط Amiri بنجاح. قد لا تظهر النصوص العربية بشكل صحيح في PDF. تأكد من وجود ملف Amiri-Regular.ttf في public/fonts/. الخطأ: ${error.message}`,
          variant: "destructive",
          duration: 7000,
        });
      }
    };
    loadFont();
  }, [toast]);


  useEffect(() => {
    if (!authLoading) {
      if (user && user.isAdmin) {
        handleRefresh().finally(() => setPageLoading(false));
      } else {
        setPageLoading(false);
      }
    }
  }, [authLoading, user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
    toast({ title: "تم تحديث البيانات" });
  };

  const commonExportColumns = [
    { header: "م", dataKey: "serial" },
    { header: "مدخل البيانات", dataKey: "submitterUsername" },
    { header: "اسم المتبرع", dataKey: "donorName" },
    { header: "الاضحية باسم", dataKey: "sacrificeFor" },
    { header: "رقم التلفون", dataKey: "phoneNumber" },
    { header: "يريد الحضور", dataKey: "wantsToAttendText" },
    { header: "يريد من الأضحية", dataKey: "wantsFromSacrificeText" },
    { header: "ماذا يريد", dataKey: "sacrificeWishes" },
    { header: "تم الدفع", dataKey: "paymentConfirmedText" },
    { header: "رقم الدفتر", dataKey: "receiptBookNumber" },
    { header: "رقم السند", dataKey: "voucherNumber" },
    { header: "عن طريق وسيط", dataKey: "throughIntermediaryText" },
    { header: "اسم الوسيط", dataKey: "intermediaryName" },
    { header: "توزع لـ", dataKey: "distributionPreferenceText" },
    { header: "تاريخ التسجيل", dataKey: "submissionDateFormatted" },
    { header: "الحالة", dataKey: "statusText" },
  ];

  const prepareDataForExport = useCallback((submissions: AdahiSubmission[]): any[] => {
    return submissions.map((sub, index) => ({
      serial: index + 1,
      submitterUsername: sub.submitterUsername || sub.userEmail || "غير معروف",
      donorName: sub.donorName,
      sacrificeFor: sub.sacrificeFor,
      phoneNumber: sub.phoneNumber,
      wantsToAttendText: sub.wantsToAttend ? "نعم" : "لا",
      wantsFromSacrificeText: sub.wantsFromSacrifice ? "نعم" : "لا",
      sacrificeWishes: sub.wantsFromSacrifice ? (sub.sacrificeWishes || "-") : "-",
      paymentConfirmedText: sub.paymentConfirmed ? "نعم" : "لا",
      receiptBookNumber: sub.paymentConfirmed ? (sub.receiptBookNumber || "-") : "-",
      voucherNumber: sub.paymentConfirmed ? (sub.voucherNumber || "-") : "-",
      throughIntermediaryText: sub.throughIntermediary ? "نعم" : "لا",
      intermediaryName: sub.throughIntermediary ? (sub.intermediaryName || "-") : "-",
      distributionPreferenceText: getDistributionLabel(sub.distributionPreference),
      submissionDateFormatted: sub.submissionDate ? format(new Date(sub.submissionDate), "dd/MM/yyyy HH:mm", { locale: ar }) : 'N/A',
      statusText: sub.status === "entered" ? "مدخلة" : "غير مدخلة",
      userId: sub.userId,
      distributionPreference: sub.distributionPreference,
    }));
  }, [getDistributionLabel]);

  const exportToExcel = (dataToExportRaw: any[], fileName: string, sheetName: string, columns: Array<{header: string, dataKey: string}>) => {
    const worksheetData = dataToExportRaw.map(item => {
      const orderedItem: any = {};
      columns.forEach(col => {
        orderedItem[col.header] = item[col.dataKey];
      });
      return orderedItem;
    });

    const ws = XLSX.utils.json_to_sheet(worksheetData, {
      header: columns.map(col => col.header)
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    if (wb.Sheets[sheetName]) {
        const sheet = wb.Sheets[sheetName];
        const headerRowIndex = 0;

        columns.forEach((col, C_idx) => {
            const cell_ref = XLSX.utils.encode_cell({ r: headerRowIndex, c: C_idx });
            if (!sheet[cell_ref]) sheet[cell_ref] = { t: 's', v: col.header };
            else sheet[cell_ref].v = col.header;

            sheet[cell_ref].s = {
                border: {
                    top: { style: "thin", color: { auto: 1 } },
                    bottom: { style: "thin", color: { auto: 1 } },
                    left: { style: "thin", color: { auto: 1 } },
                    right: { style: "thin", color: { auto: 1 } },
                },
                alignment: { horizontal: "center", vertical: "center", wrapText: true },
                font: { bold: true }
            };
        });

        worksheetData.forEach((_rowData, R_idx) => {
            columns.forEach((_col, C_idx) => {
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

        const colWidths = columns.map(column => ({ wch: Math.max(15, String(column.header).length + 5) }));
        sheet['!cols'] = colWidths;
        sheet['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(sheet['!ref']!)) };
        sheet['!props'] = { rtl: true };
    }

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const generatePdfDoc = (title: string) => {
    const pdfDoc = new jsPDF({
      orientation: 'l',
      unit: 'pt',
      format: 'a4'
    });

    pdfDoc.setLanguage('ar');
    pdfDoc.setR2L(true);

    if (fontLoadedSuccessfully && amiriFontBase64) {
      try {
        pdfDoc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        pdfDoc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        pdfDoc.setFont('Amiri');
      } catch (e) {
        console.error("Error adding Amiri font to PDF (VFS or font registration):", e);
        toast({ title: "خطأ في خط PDF", description: "لم يتم تطبيق الخط العربي بشكل كامل للعناوين.", variant: "destructive"});
        pdfDoc.setFont('Helvetica'); // Fallback font
      }
    } else {
        pdfDoc.setFont('Helvetica'); // Fallback font if Amiri not loaded
    }

    const pageWidth = pdfDoc.internal.pageSize.getWidth();

    // Setting font again before rendering text, explicitly
    if (fontLoadedSuccessfully) pdfDoc.setFont('Amiri'); else pdfDoc.setFont('Helvetica');
    pdfDoc.setFontSize(18);
    pdfDoc.text(title, pageWidth - PDF_MARGIN, PDF_MARGIN, { align: 'right' }); // Align title to the right

    if (fontLoadedSuccessfully) pdfDoc.setFont('Amiri'); else pdfDoc.setFont('Helvetica');
    pdfDoc.setFontSize(10);
    const exportDateText = `تاريخ التصدير: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ar })}`;
    pdfDoc.text(exportDateText, pageWidth - PDF_MARGIN, PDF_MARGIN + 25, { align: 'right' }); // Align date to the right

    return pdfDoc;
  };

  const addTableToPdf = (pdfDoc: jsPDF, data: any[], columns: Array<{header: string, dataKey: string}>, startY: number) => {
    const tableHeaders = columns.map(col => col.header);
    const tableBody = data.map(item => columns.map(col => {
      let cellValue = item[col.dataKey] !== undefined && item[col.dataKey] !== null ? String(item[col.dataKey]) : '';
      return cellValue;
    }));

    pdfDoc.autoTable({
      startY: startY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: fontLoadedSuccessfully ? 'Amiri' : 'Helvetica',
        halign: 'right',
        cellPadding: 5,
        fontSize: 8,
        overflow: 'linebreak'
      },
      headStyles: {
        font: fontLoadedSuccessfully ? 'Amiri' : 'Helvetica',
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        halign: 'right', // Align table headers to the right
      },
      didDrawPage: (data) => {
        const pageCount = pdfDoc.internal.pages.length -1;
        if (fontLoadedSuccessfully) {
          pdfDoc.setFont('Amiri');
        } else {
          pdfDoc.setFont('Helvetica');
        }
        pdfDoc.setFontSize(8);
        const pageNumText = `صفحة ${data.pageNumber} من ${pageCount}`;
        pdfDoc.text(pageNumText, pdfDoc.internal.pageSize.getWidth() - PDF_MARGIN, pdfDoc.internal.pageSize.getHeight() - 20, { align: 'right' });
      }
    });
  };

  const handleExportAllExcel = async () => {
    if (allSubmissionsForAdmin.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    setExportingType('allExcel');
    try {
      const dataToExport = prepareDataForExport(allSubmissionsForAdmin);
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
      const dataToExport = prepareDataForExport(gazaSubmissions);
      exportToExcel(dataToExport, "أضاحي_غزة", "أهل غزة", commonExportColumns);
      toast({ title: "تم تصدير أضاحي غزة (Excel) بنجاح" });
    } catch (error) {
      console.error("Error exporting Gaza to Excel:", error);
      toast({ title: "خطأ في التصدير (Excel)", description: "حدث خطأ أثناء محاولة تصدير أضاحي غزة.", variant: "destructive" });
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
      const submissionsByUser: { [key: string]: AdahiSubmission[] } = {};
      allSubmissionsForAdmin.forEach(sub => {
        const userId = sub.userId || 'unknown_user';
        if (!submissionsByUser[userId]) {
          submissionsByUser[userId] = [];
        }
        submissionsByUser[userId].push(sub);
      });

      for (const userId in submissionsByUser) {
        const userProfile = await fetchUserById(userId);
        const userName = userProfile?.username || userId;
        const userSubmissions = submissionsByUser[userId];
        if (userSubmissions.length > 0) {
            const dataToExport = prepareDataForExport(userSubmissions);
            exportToExcel(dataToExport, `أضاحي_المستخدم_${userName.replace(/\s+/g, '_')}`, userName, commonExportColumns);
        }
      }
      toast({ title: "تم تصدير الأضاحي حسب المستخدم (Excel) بنجاح" });
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
     if (!fontLoadedSuccessfully && !amiriFontBase64) {
        toast({
            title: "خطأ في الخط",
            description: "لم يتم تحميل الخط العربي اللازم لإنشاء ملفات PDF. يرجى المحاولة مرة أخرى أو التأكد من اتصال جيد بالإنترنت.",
            variant: "destructive",
            duration: 7000
        });
        setExportingType(null);
        return;
    }
    setExportingType('allPdf');
    try {
      const dataToExport = prepareDataForExport(allSubmissionsForAdmin);
      const pdfDoc = generatePdfDoc("تقرير جميع الأضاحي");
      addTableToPdf(pdfDoc, dataToExport, commonExportColumns, PDF_MARGIN + 60);
      pdfDoc.save("جميع_الأضاحي.pdf");
      toast({ title: "تم تصدير جميع الأضاحي (PDF) بنجاح" });
    } catch (error) {
      console.error("Error exporting all to PDF:", error);
      toast({ title: "خطأ في التصدير (PDF)", description: "حدث خطأ أثناء محاولة تصدير جميع الأضاحي.", variant: "destructive" });
    }
    setExportingType(null);
  };

  const handleExportGazaPdf = async () => {
    const gazaSubmissionsRaw = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza');
    if (gazaSubmissionsRaw.length === 0) {
      toast({ title: "لا توجد أضاحي لغزة للتصدير" });
      return;
    }
     if (!fontLoadedSuccessfully && !amiriFontBase64) {
        toast({
            title: "خطأ في الخط",
            description: "لم يتم تحميل الخط العربي اللازم لإنشاء ملفات PDF. يرجى المحاولة مرة أخرى أو التأكد من اتصال جيد بالإنترنت.",
            variant: "destructive",
            duration: 7000
        });
        setExportingType(null);
        return;
    }
    setExportingType('gazaPdf');
    try {
      const dataToExport = prepareDataForExport(gazaSubmissionsRaw);
      const pdfDoc = generatePdfDoc("تقرير أضاحي غزة");
      addTableToPdf(pdfDoc, dataToExport, commonExportColumns, PDF_MARGIN + 60);
      pdfDoc.save("أضاحي_غزة.pdf");
      toast({ title: "تم تصدير أضاحي غزة (PDF) بنجاح" });
    } catch (error) {
      console.error("Error exporting Gaza to PDF:", error);
      toast({ title: "خطأ في التصدير (PDF)", description: "حدث خطأ أثناء محاولة تصدير أضاحي غزة.", variant: "destructive" });
    }
    setExportingType(null);
  };

  const handleExportByUserPdf = async () => {
    if (!fontLoadedSuccessfully && !amiriFontBase64) {
        toast({
            title: "خطأ في الخط",
            description: "لم يتم تحميل الخط العربي اللازم لإنشاء ملفات PDF. يرجى المحاولة مرة أخرى أو التأكد من اتصال جيد بالإنترنت.",
            variant: "destructive",
            duration: 7000
        });
        setExportingType(null);
        return;
    }
    if (allSubmissionsForAdmin.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    setExportingType('userPdf');
    try {
      const submissionsByUser: { [key: string]: AdahiSubmission[] } = {};
      allSubmissionsForAdmin.forEach(sub => {
        const userId = sub.userId || 'unknown_user';
        if (!submissionsByUser[userId]) {
          submissionsByUser[userId] = [];
        }
        submissionsByUser[userId].push(sub);
      });

      for (const userId in submissionsByUser) {
        const userProfile = await fetchUserById(userId);
        const userName = userProfile?.username || userId;
        const userSubmissionsRaw = submissionsByUser[userId];
        if (userSubmissionsRaw.length > 0) {
            const dataToExport = prepareDataForExport(userSubmissionsRaw);
            const pdfDoc = generatePdfDoc(`تقرير أضاحي المستخدم: ${userName}`);
            addTableToPdf(pdfDoc, dataToExport, commonExportColumns, PDF_MARGIN + 60);
            pdfDoc.save(`أضاحي_${userName.replace(/\s+/g, '_')}.pdf`);
        }
      }
      toast({ title: "تم تصدير الأضاحي حسب المستخدم (PDF) بنجاح" });
    } catch (error) {
      console.error("Error exporting by user to PDF:", error);
      toast({ title: "خطأ في التصدير (PDF)", description: "حدث خطأ أثناء محاولة تصدير الأضاحي حسب المستخدم.", variant: "destructive" });
    }
    setExportingType(null);
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

  const stats = {
    total: allSubmissionsForAdmin.length,
    gaza: allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza').length,
    ramthaAndDonor: allSubmissionsForAdmin.filter(s => s.distributionPreference === 'ramtha' || s.distributionPreference === 'donor').length,
    fund: allSubmissionsForAdmin.filter(s => s.distributionPreference === 'fund').length,
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2 pb-6 border-b">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          إدارة الأضاحي
        </h1>
        <p className="text-md sm:text-lg text-muted-foreground">
          عرض وتعديل وحذف جميع الأضاحي المسجلة في النظام.
        </p>
        <p className="text-sm text-muted-foreground pt-1">
          إجمالي الأضاحي: {stats.total} |
          أضاحي للرمثا والمتبرعين: {stats.ramthaAndDonor} |
          لأهل غزة: {stats.gaza} |
          لصندوق التضامن: {stats.fund}
        </p>
      </header>

      <section aria-labelledby="stats-heading" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأضاحي</CardTitle>
            <TableIcon className="h-4 w-4 text-muted-foreground" data-ai-hint="table stats" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أضاحي للرمثا والمتبرعين</CardTitle>
            <HandHelping className="h-4 w-4 text-muted-foreground" data-ai-hint="charity giving" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ramthaAndDonor}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أضاحي لأهل غزة</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" data-ai-hint="analytics chart" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.gaza}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">لصندوق التضامن</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" data-ai-hint="donation fund" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fund}</div>
          </CardContent>
        </Card>
      </section>

      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold">خيارات التصدير وجدول الإدخالات</h2>
        <div className="flex flex-wrap items-center justify-start gap-2 p-3 border rounded-md bg-card shadow-sm">
          <Button onClick={handleRefresh} variant="outline" disabled={exportingType !== null || authLoading || isRefreshing}>
            {isRefreshing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
            تحديث البيانات
          </Button>

          {/* Excel Exports */}
          <Button onClick={handleExportAllExcel} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0} className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700">
            {exportingType === 'allExcel' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileDown className="ml-2 h-4 w-4" />}
            تصدير الكل (Excel)
          </Button>
          <Button onClick={handleExportGazaExcel} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza').length === 0} className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700">
            {exportingType === 'gazaExcel' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileDown className="ml-2 h-4 w-4" />}
            أضاحي غزة (Excel)
          </Button>
          <Button onClick={handleExportByUserExcel} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0} className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700">
            {exportingType === 'userExcel' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Users className="ml-2 h-4 w-4" />}
            حسب المستخدم (Excel)
          </Button>

          {/* PDF Exports */}
          <Button onClick={handleExportAllPdf} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0 || !fontLoadedSuccessfully} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700">
            {exportingType === 'allPdf' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileText className="ml-2 h-4 w-4" />}
            تصدير الكل (PDF)
          </Button>
          <Button onClick={handleExportGazaPdf} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza').length === 0 || !fontLoadedSuccessfully} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700">
            {exportingType === 'gazaPdf' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileText className="ml-2 h-4 w-4" />}
            أضاحي غزة (PDF)
          </Button>
          <Button onClick={handleExportByUserPdf} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0 || !fontLoadedSuccessfully} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700">
            {exportingType === 'userPdf' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileText className="ml-2 h-4 w-4" />}
            حسب المستخدم (PDF)
          </Button>
        </div>
      </div>

      <AdminSubmissionsTable submissions={allSubmissionsForAdmin} onDataChange={handleRefresh} />
    </div>
  );
}

export default AdminPage;

    