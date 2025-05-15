
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
import { format } from "date-fns";
import { ar } from "date-fns/locale";

// Import pdfMake and vfs_fonts
import pdfMake from 'pdfmake/build/pdfmake';
//  تأكد من أن هذا المسار صحيح وأن الملف custom_vfs_fonts.js موجود فيه
//  هذا الملف يجب أن يحتوي على بيانات خط Amiri (وغيره من الخطوط التي تريدها)
import '@/lib/custom_vfs_fonts.js'; //  <<<<----  تم تغيير هذا السطر

//  يفترض أن pdfMake.vfs قد تم تهيئته الآن بواسطة الاستيراد أعلاه لملف الخطوط المخصص.

// Configure Amiri font for pdfMake
// IMPORTANT: For Amiri (or any custom font) to work correctly,
// the font data (e.g., Amiri-Regular.ttf) must be included in the
// pdfMake.vfs (virtual file system). This usually means creating a custom
// vfs_fonts.js file that includes the Base64 encoded font data and importing that.
// The configuration below tells pdfMake *about* the font, but it still needs the data from vfs.
if (pdfMake.fonts) {
    pdfMake.fonts = {
      ...pdfMake.fonts, // Preserve any default fonts
      Amiri: {
        normal: 'Amiri-Regular.ttf', // This filename must match the font file name *within* your VFS
        bold: 'Amiri-Bold.ttf',    //  يجب أن يكون هذا الملف موجودًا في vfs_fonts.js إذا كنت ستستخدم الخط العريض
        italics: 'Amiri-Italic.ttf', //  يجب أن يكون هذا الملف موجودًا في vfs_fonts.js إذا كنت ستستخدم الخط المائل
        bolditalics: 'Amiri-BoldItalic.ttf' //  يجب أن يكون هذا الملف موجودًا في vfs_fonts.js إذا كنت ستستخدم الخط العريض المائل
      }
    };
} else {
    // This case might occur if pdfmake.js didn't initialize .fonts property
    pdfMake.fonts = {
      Amiri: {
        normal: 'Amiri-Regular.ttf',
        bold: 'Amiri-Bold.ttf',
        italics: 'Amiri-Italic.ttf',
        bolditalics: 'Amiri-BoldItalic.ttf'
      }
    };
}


const AdminPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, user, fetchUserById } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [exportingType, setExportingType] = useState<string | null>(null);

  const PDF_MARGIN = 40;

  // Check if Amiri font is configured in pdfMake.fonts AND vfs is populated with SOMETHING
  const isAmiriFontConfigured = !!(pdfMake.fonts && pdfMake.fonts.Amiri && pdfMake.fonts.Amiri.normal && pdfMake.vfs && Object.keys(pdfMake.vfs).length > 0);

  useEffect(() => {
    if (!isAmiriFontConfigured) {
      toast({
        title: "تنبيه بخصوص خط PDF",
        description: "لم يتم تكوين خط Amiri بشكل كامل لـ pdfMake (قد يكون VFS غير محمل بشكل صحيح أو الخط غير مسجل في vfs_fonts.js). قد لا تظهر النصوص العربية بشكل صحيح في ملفات PDF.",
        variant: "destructive",
        duration: 10000,
      });
    }
  }, [isAmiriFontConfigured, toast]);


  const getDistributionLabel = useCallback((value?: DistributionPreference | string) => {
    if (!value) return "غير محدد";
    return distributionOptions.find(opt => opt.value === value)?.label || String(value);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user && user.isAdmin) {
        handleRefresh().finally(() => setPageLoading(false));
      } else {
        setPageLoading(false);
      }
    }
  }, [authLoading, user]); // Removed handleRefresh from dependencies to avoid re-running on every render

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
      userId: sub.userId, // Keep original fields for filtering if needed
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
      header: columns.map(col => col.header) // Use original headers for sheet creation
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    if (wb.Sheets[sheetName]) {
        const sheet = wb.Sheets[sheetName];
        // Ensure header cells are created if they don't exist, and apply styles
        const headerRowIndex = 0; // Typically the first row

        columns.forEach((col, C_idx) => {
            const cell_ref = XLSX.utils.encode_cell({ r: headerRowIndex, c: C_idx });
            if (!sheet[cell_ref]) sheet[cell_ref] = { t: 's', v: col.header }; // Create cell if not exists
            else sheet[cell_ref].v = col.header; // Ensure header text is correct

            // Style for header
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

        // Apply border and alignment to data cells
        worksheetData.forEach((_rowData, R_idx) => {
            columns.forEach((_col, C_idx) => {
                const cell_ref = XLSX.utils.encode_cell({ r: R_idx + 1, c: C_idx }); // Data rows start from R_idx + 1
                if (sheet[cell_ref] && sheet[cell_ref].v !== undefined && sheet[cell_ref].v !== null && sheet[cell_ref].v !== "") {
                    sheet[cell_ref].s = {
                        ...(sheet[cell_ref].s || {}), // Preserve existing styles if any
                        border: {
                            top: { style: "thin", color: { auto: 1 } },
                            bottom: { style: "thin", color: { auto: 1 } },
                            left: { style: "thin", color: { auto: 1 } },
                            right: { style: "thin", color: { auto: 1 } },
                        },
                        alignment: { ...(sheet[cell_ref].s?.alignment || {}), horizontal: "right", vertical: "center", wrapText: true }
                    };
                } else if (sheet[cell_ref]) { // Cell exists but might be empty, still apply alignment
                     sheet[cell_ref].s = {
                        ...(sheet[cell_ref].s || {}),
                        alignment: { ...(sheet[cell_ref].s?.alignment || {}), horizontal: "right", vertical: "center", wrapText: true }
                    };
                }
            });
        });

        const colWidths = columns.map(column => ({ wch: Math.max(15, String(column.header).length + 5) }));
        sheet['!cols'] = colWidths;
        sheet['!props'] = { rtl: true }; // Enable RTL for the sheet
        sheet['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(sheet['!ref']!)) }; // Add autofilter
    }
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  // Function to generate PDF using pdfMake
  const generatePdfMakeDocument = (title: string, data: any[], columns: Array<{header: string, dataKey: string}>, fileName: string) => {
    if (!isAmiriFontConfigured) {
      toast({
        title: "خطأ في إعداد الخط لـ PDF",
        description: "لم يتم إعداد خط Amiri بشكل صحيح لـ pdfMake. لا يمكن إنشاء PDF. يرجى التأكد من أن ملف الخطوط (vfs_fonts.js) يتضمن الخط وأن الإعدادات صحيحة.",
        variant: "destructive",
        duration: 7000,
      });
      return;
    }

    const tableHeaders = columns.map(col => ({ text: col.header, style: 'tableHeader', alignment: 'right' as const }));
    const tableBody = data.map(item =>
      columns.map(col => ({ text: (item[col.dataKey] !== undefined && item[col.dataKey] !== null ? String(item[col.dataKey]) : ''), alignment: 'right' as const }))
    );

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [PDF_MARGIN, PDF_MARGIN, PDF_MARGIN, PDF_MARGIN + 20], // left, top, right, bottom (extra bottom for footer)
      content: [
        { text: title, style: 'header', alignment: 'center' as const, margin: [0, 0, 0, 10] },
        { text: `تاريخ التصدير: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ar })}`, style: 'subheader', alignment: 'center' as const, margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: columns.map(() => '*' as const), // Distribute column widths equally
            body: [tableHeaders, ...tableBody],
            layout: 'lightHorizontalLines' // A common, clean layout
          },
        }
      ],
      defaultStyle: {
        font: 'Amiri', // Use Amiri as the default font
        fontSize: 10,
        alignment: 'right' as const // Set default alignment to right for Arabic
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: 'center' as const
        },
        subheader: {
          fontSize: 12,
          alignment: 'center' as const
        },
        tableHeader: {
          bold: true,
          fontSize: 11, // Adjusted for better readability
          color: 'black',
          fillColor: '#eeeeee',
          alignment: 'right' as const // Ensure header text is also right-aligned
        }
      },
      footer: function(currentPage: number, pageCount: number) {
        return {
          text: `صفحة ${currentPage.toString()} من ${pageCount.toString()}`,
          alignment: 'center' as const,
          style: 'footer',
          margin: [0, 10, 0, 0] // margin for footer: [left, top, right, bottom]
        };
      }
    };

    try {
      pdfMake.createPdf(docDefinition).download(`${fileName}.pdf`);
    } catch (error) {
      console.error("Error creating PDF with pdfMake:", error);
      toast({ title: "خطأ في إنشاء PDF", description: "حدث خطأ أثناء محاولة إنشاء ملف PDF.", variant: "destructive" });
    }
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
      // Group submissions by userId
      allSubmissionsForAdmin.forEach(sub => {
        const userId = sub.userId || 'unknown_user'; // Handle cases where userId might be missing
        if (!submissionsByUser[userId]) {
          submissionsByUser[userId] = [];
        }
        submissionsByUser[userId].push(sub);
      });

      // Iterate over each user and export their submissions
      for (const userId in submissionsByUser) {
        const userProfile = await fetchUserById(userId);
        const userName = userProfile?.username || userId; // Fallback to userId if username is not found
        const userSubmissions = submissionsByUser[userId];
        if (userSubmissions.length > 0) {
            const dataToExport = prepareDataForExport(userSubmissions);
            // Sanitize username for filename
            const safeUserName = userName.replace(/[<>:"/\\|?* ]/g, '_');
            exportToExcel(dataToExport, `أضاحي_المستخدم_${safeUserName}`, userName, commonExportColumns);
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
    if (!isAmiriFontConfigured) {
      toast({ title: "خطأ في إعداد الخط لـ PDF", description: "لا يمكن إنشاء PDF بدون إعداد خط Amiri لـ pdfMake.", variant: "destructive" });
      return;
    }
    setExportingType('allPdf');
    try {
      const dataToExport = prepareDataForExport(allSubmissionsForAdmin);
      generatePdfMakeDocument("تقرير جميع الأضاحي", dataToExport, commonExportColumns, "جميع_الأضاحي");
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
    if (!isAmiriFontConfigured) {
      toast({ title: "خطأ في إعداد الخط لـ PDF", description: "لا يمكن إنشاء PDF بدون إعداد خط Amiri لـ pdfMake.", variant: "destructive" });
      return;
    }
    setExportingType('gazaPdf');
    try {
      const dataToExport = prepareDataForExport(gazaSubmissionsRaw);
      generatePdfMakeDocument("تقرير أضاحي غزة", dataToExport, commonExportColumns, "أضاحي_غزة");
      toast({ title: "تم تصدير أضاحي غزة (PDF) بنجاح" });
    } catch (error) {
      console.error("Error exporting Gaza to PDF:", error);
      toast({ title: "خطأ في التصدير (PDF)", description: "حدث خطأ أثناء محاولة تصدير أضاحي غزة.", variant: "destructive" });
    }
    setExportingType(null);
  };

  const handleExportByUserPdf = async () => {
    if (allSubmissionsForAdmin.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    if (!isAmiriFontConfigured) {
      toast({ title: "خطأ في إعداد الخط لـ PDF", description: "لا يمكن إنشاء PDF بدون إعداد خط Amiri لـ pdfMake.", variant: "destructive" });
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
            const safeUserName = userName.replace(/[<>:"/\\|?* ]/g, '_');
            generatePdfMakeDocument(`تقرير أضاحي المستخدم: ${userName}`, dataToExport, commonExportColumns, `أضاحي_${safeUserName}`);
        }
      }
      toast({ title: "تم تصدير الأضاحي حسب المستخدم (ملفات PDF منفصلة) بنجاح" });
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
          <Button onClick={handleExportAllPdf} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0 || !isAmiriFontConfigured} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700">
            {exportingType === 'allPdf' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileText className="ml-2 h-4 w-4" />}
            تصدير الكل (PDF)
          </Button>
          <Button onClick={handleExportGazaPdf} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza').length === 0 || !isAmiriFontConfigured} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700">
            {exportingType === 'gazaPdf' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileText className="ml-2 h-4 w-4" />}
            أضاحي غزة (PDF)
          </Button>
          <Button onClick={handleExportByUserPdf} variant="outline" disabled={exportingType !== null || allSubmissionsForAdmin.length === 0 || !isAmiriFontConfigured} className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700">
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

    

    