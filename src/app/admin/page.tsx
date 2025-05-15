
"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { FileDown, Settings2, TableIcon, BarChart3, HandHelping, Coins, RefreshCw, Loader2, Users, FileText, Sheet } from "lucide-react";
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
// تأكد من أن هذا المسار صحيح وأن الملف vfs_fonts.js موجود فيه
// هذا الملف يجب أن يحتوي على بيانات خط Amiri (وغيره من الخطوط التي تريدها)
import '@/lib/vfs_fonts.js'; //  <<<<---- تأكد من أن هذا الملف موجود في src/lib/

// يفترض أن pdfMake.vfs قد تم تهيئته الآن بواسطة الاستيراد أعلاه لملف الخطوط المخصص.

// Configure Amiri font for pdfMake
// IMPORTANT: For Amiri (or any custom font) to work correctly,
// you MUST have the font data (e.g., Amiri-Regular.ttf, Amiri-Bold.ttf)
// properly compiled into the vfs_fonts.js file you are importing.
// The names 'Amiri-Regular.ttf', 'Amiri-Bold.ttf' etc. in this config
// MUST MATCH the font file names *within* your VFS.
if (pdfMake.fonts) {
    pdfMake.fonts = {
      ...pdfMake.fonts, // Preserve any default fonts
      Amiri: {
        normal: 'Amiri-Regular.ttf', 
        bold: 'Amiri-Bold.ttf',
        italics: 'Amiri-Italic.ttf', //  يفضل أن يكون لديك ملف Amiri-Italic.ttf في VFS
        bolditalics: 'Amiri-BoldItalic.ttf' // يفضل أن يكون لديك ملف Amiri-BoldItalic.ttf في VFS
      }
    };
} else {
    pdfMake.fonts = {
      Amiri: {
        normal: 'Amiri-Regular.ttf',
        bold: 'Amiri-Bold.ttf',
        italics: 'Amiri-Italic.ttf',
        bolditalics: 'Amiri-BoldItalic.ttf'
      }
    };
}

const PDF_MARGIN = 40;

// Helper function to reverse Arabic text for PDFMake (word order)
const reverseTextForPdfMake = (text: string | undefined | null): string => {
  if (!text) return '';
  // This simple reversal might not be perfect for all complex Arabic text but can help with word order.
  return text.split(' ').reverse().join('  '); // Using double space to ensure some separation
};


const AdminPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, user, fetchUserById } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [exportingType, setExportingType] = useState<string | null>(null);

  // Check if Amiri font is configured in pdfMake.fonts AND vfs is populated
  const isAmiriFontConfigured = !!(pdfMake.fonts && pdfMake.fonts.Amiri && pdfMake.fonts.Amiri.normal && pdfMake.vfs && Object.keys(pdfMake.vfs).length > 0);

  useEffect(() => {
    if (!isAmiriFontConfigured && (exportingType?.includes('Pdf'))) { // Show only if PDF export is attempted
      toast({
        title: "تنبيه بخصوص خط PDF",
        description: "لم يتم تكوين خط Amiri بشكل كامل لـ pdfMake (قد يكون VFS غير محمل بشكل صحيح أو الخط غير مسجل في vfs_fonts.js). قد لا تظهر النصوص العربية بشكل صحيح في ملفات PDF.",
        variant: "destructive",
        duration: 10000,
      });
    }
  }, [isAmiriFontConfigured, toast, exportingType]);

  const getDistributionLabel = useCallback((value?: DistributionPreference | string) => {
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
    if (!authLoading) {
      if (user && user.isAdmin) {
        handleRefresh().finally(() => setPageLoading(false));
      } else {
        setPageLoading(false);
      }
    }
  }, [authLoading, user, handleRefresh]);

  const commonExportColumns = [
    { header: "م", dataKey: "serial" },
    { header: "اسم المتبرع", dataKey: "donorName" },
    { header: "الاضحية باسم", dataKey: "sacrificeFor" },
    { header: "رقم التلفون", dataKey: "phoneNumber" },
    { header: "اسم المستخدم", dataKey: "submitterUsername"},
    { header: "يريد الحضور", dataKey: "wantsToAttendText" },
    { header: "يريد من الأضحية", dataKey: "wantsFromSacrificeText" },
    { header: "ماذا يريد", dataKey: "sacrificeWishes" },
    { header: "تم الدفع", dataKey: "paymentConfirmedText" },
    { header: "توزع لـ", dataKey: "distributionPreferenceText" },
  ];

  const prepareDataForExport = useCallback(async (submissions: AdahiSubmission[]): Promise<any[]> => {
    const prepared = [];
    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];
      let submitterUsername = sub.submitterUsername || sub.userEmail || "غير معروف";
      if (!sub.submitterUsername && sub.userId) {
        const submitterProfile = await fetchUserById(sub.userId);
        if (submitterProfile && submitterProfile.username) {
          submitterUsername = submitterProfile.username;
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
        distributionPreferenceText: getDistributionLabel(sub.distributionPreference),
        receiptBookNumber: sub.paymentConfirmed ? (sub.receiptBookNumber || "-") : "-",
        voucherNumber: sub.paymentConfirmed ? (sub.voucherNumber || "-") : "-",
        throughIntermediaryText: sub.throughIntermediary ? "نعم" : "لا",
        intermediaryName: sub.throughIntermediary ? (sub.intermediaryName || "-") : "-",
        submissionDateFormatted: sub.submissionDate ? format(new Date(sub.submissionDate), "dd/MM/yyyy HH:mm", { locale: ar }) : 'N/A',
        statusText: sub.status === "entered" ? "مدخلة" : "غير مدخلة",
        userId: sub.userId,
        distributionPreference: sub.distributionPreference,
      });
    }
    return prepared;
  }, [getDistributionLabel, fetchUserById]);


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
        const headerRowIndex = 0; // Assuming headers are in the first row

        // Style header row
        columns.forEach((_col, C_idx) => {
            const cell_ref = XLSX.utils.encode_cell({ r: headerRowIndex, c: C_idx });
            if (sheet[cell_ref]) {
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
            }
        });
        
        // Style data rows
        worksheetData.forEach((_rowData, R_idx) => {
            columns.forEach((_col, C_idx) => {
                const cell_ref = XLSX.utils.encode_cell({ r: R_idx + 1, c: C_idx }); // R_idx + 1 because data starts after header
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
                } else if (sheet[cell_ref]) { // Apply border even to empty cells if they exist in the sheet object
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
                }
            });
        });

        const colWidths = columns.map(column => ({ wch: Math.max(15, String(column.header).length + 5) }));
        sheet['!cols'] = colWidths;
        sheet['!props'] = { rtl: true }; // Set sheet direction to RTL
        sheet['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(sheet['!ref']!)) }; // Enable autofilter for the entire sheet
    }
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const generatePdfMakeDocument = (title: string, data: any[], columns: Array<{header: string, dataKey: string}>, fileName: string) => {
    if (!isAmiriFontConfigured) {
      toast({
        title: "خطأ في إعداد الخط لـ PDF",
        description: "لم يتم إعداد خط Amiri بشكل صحيح لـ pdfMake. لا يمكن إنشاء PDF.",
        variant: "destructive",
        duration: 7000,
      });
      return;
    }
    
    // For PDF, reverse columns for visual RTL, and reverse header text
    const pdfColumns = [...columns].reverse(); 
    
    const tableHeaders = pdfColumns.map(col => ({ text: reverseTextForPdfMake(col.header), style: 'tableHeader', alignment: 'right' as const }));
    
    const tableBody = data.map(item =>
        pdfColumns.map(col => ({ text: reverseTextForPdfMake(item[col.dataKey] !== undefined && item[col.dataKey] !== null ? String(item[col.dataKey]) : ''), alignment: 'right' as const }))
    );
    
    const reversedTitle = reverseTextForPdfMake(title);
    const exportDateText = `تاريخ التصدير: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ar })}`;
    const reversedExportDateText = reverseTextForPdfMake(exportDateText);

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [PDF_MARGIN, PDF_MARGIN + 20, PDF_MARGIN, PDF_MARGIN + 20], 
      content: [
        { text: reversedTitle, style: 'header', alignment: 'right' as const, margin: [0, 0, 0, 10] },
        { text: reversedExportDateText, style: 'subheader', alignment: 'right' as const, margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: pdfColumns.map(() => '*' as const), 
            body: [tableHeaders, ...tableBody],
          },
          layout: {
            fillColor: function (rowIndex: number, node: any, columnIndex: number) {
              return (rowIndex === 0) ? '#CCCCCC' : null;
            },
            hLineWidth: function (i: number, node: any) { return (i === 0 || i === node.table.body.length) ? 1 : 1; },
            vLineWidth: function (i: number, node: any) { return (i === 0 || i === node.table.widths.length) ? 1 : 1; },
            hLineColor: function (i: number, node: any) { return 'black'; },
            vLineColor: function (i: number, node: any) { return 'black'; }
          }
        }
      ],
      defaultStyle: {
        font: 'Amiri', 
        fontSize: 10,
        alignment: 'right' as const
      },
      styles: {
        header: {
          fontSize: 18,
          // bold: false, // Keep bold if Amiri-Bold is properly loaded in VFS
          alignment: 'right' as const
        },
        subheader: {
          fontSize: 12,
          alignment: 'right' as const
        },
        tableHeader: {
          // bold: false, // Keep bold if Amiri-Bold is properly loaded in VFS
          fontSize: 8, 
          color: 'black',
          alignment: 'right' as const 
        }
      },
      footer: function(currentPage: number, pageCount: number) {
        const pageNumText = `صفحة ${currentPage.toString()} من ${pageCount.toString()}`;
        const reversedPageNumText = reverseTextForPdfMake(pageNumText);
        return {
          text: reversedPageNumText,
          alignment: 'center' as const,
          style: { font: 'Amiri', fontSize: 8 },
          margin: [0, 10, 0, 0]
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

  const handleExportByUserExcel = async () => {
    if (allSubmissionsForAdmin.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    setExportingType('userExcel');
    try {
      const submissionsByUser: { [key: string]: AdahiSubmission[] } = {};
      const allDataPrepared = await prepareDataForExport(allSubmissionsForAdmin); // Prepare all data once
      
      allDataPrepared.forEach(subPrepared => {
          const originalSub = allSubmissionsForAdmin.find(s => s.id === subPrepared.id); // Find original to get userId for username fetch
          let userName = subPrepared.submitterUsername || 'مستخدم_غير_معروف'; // Use already prepared username
          
          const userKey = userName.replace(/[<>:"/\\|?* ]/g, '_'); 

          if (!submissionsByUser[userKey]) {
              submissionsByUser[userKey] = [];
          }
          submissionsByUser[userKey].push(subPrepared); // Push the prepared submission
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
    if (!isAmiriFontConfigured) {
      toast({ title: "خطأ في إعداد الخط لـ PDF", description: "لا يمكن إنشاء PDF بدون إعداد خط Amiri لـ pdfMake.", variant: "destructive" });
      return;
    }
    setExportingType('allPdf');
    try {
      const dataToExport = await prepareDataForExport(allSubmissionsForAdmin);
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
      const dataToExport = await prepareDataForExport(gazaSubmissionsRaw);
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
      const submissionsByUser: { [key: string]: any[] } = {}; // Store prepared data
      const allDataPrepared = await prepareDataForExport(allSubmissionsForAdmin);

      allDataPrepared.forEach(subPrepared => {
          let userName = subPrepared.submitterUsername || 'مستخدم_غير_معروف';
          const userKey = userName.replace(/[<>:"/\\|?* ]/g, '_'); 

          if (!submissionsByUser[userKey]) {
              submissionsByUser[userKey] = [];
          }
          submissionsByUser[userKey].push(subPrepared);
      });

      for (const userNameKey in submissionsByUser) {
        const userSubmissionsData = submissionsByUser[userNameKey];
        if (userSubmissionsData.length > 0) {
            generatePdfMakeDocument(`تقرير أضاحي المستخدم: ${userNameKey}`, userSubmissionsData, commonExportColumns, `أضاحي_${userNameKey}`);
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
          تسجيل الأضاحي
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
