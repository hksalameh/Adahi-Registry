
"use client";

import AdminSubmissionsTable from "@/components/tables/AdminSubmissionsTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { FileDown, Settings2, TableIcon, BarChart3, Archive, HandHelping, PiggyBank } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { AdahiSubmission } from "@/lib/types";
import { distributionOptions } from "@/lib/types"; // Import distributionOptions
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import * as XLSX from 'xlsx';

// Function to export data to XLSX (Excel format)
const exportToXlsx = (data: AdahiSubmission[], filename: string) => {
  console.log(`Exporting data to ${filename}.xlsx:`, data);
  return new Promise<void>((resolve) => {
    setTimeout(() => { // Simulate async operation
      if (data.length === 0) {
        resolve();
        return;
      }

      // Headers in the order they should appear from right to left in an RTL sheet
      const headers = [
        "رقم تسلسلي",
        "اسم المتبرع",
        "الاضحية عن",
        "رقم التلفون",
        "يريد الحضور",
        "يريد من الأضحية",
        "اسم المستخدم",
        "تم الدفع",
        "عن طريق", // Renamed from "الاضحية عن طريق"
        "لمن ستوزع الاضحية"
      ];

      const mappedData = data.map((sub, index) => ({
        "رقم تسلسلي": index + 1,
        "اسم المتبرع": sub.donorName,
        "الاضحية عن": sub.sacrificeFor,
        "رقم التلفون": sub.phoneNumber,
        "يريد الحضور": sub.wantsToAttend ? "نعم" : "لا",
        "يريد من الأضحية": sub.wantsFromSacrifice 
          ? `نعم${sub.sacrificeWishes ? ` (${sub.sacrificeWishes})` : ''}` 
          : "لا",
        "اسم المستخدم": sub.submitterUsername || sub.userEmail || sub.userId || "غير متوفر",
        "تم الدفع": sub.paymentConfirmed ? "نعم" : "لا",
        "عن طريق": sub.throughIntermediary 
          ? `نعم${sub.intermediaryName ? ` (${sub.intermediaryName})` : ''}` 
          : "لا",
        "لمن ستوزع الاضحية": distributionOptions.find(opt => opt.value === sub.distributionPreference)?.label || sub.distributionPreference || "غير محدد",
      }));
      
      // Create worksheet with specified header order
      const worksheet = XLSX.utils.json_to_sheet(mappedData, { header: headers });

      // Set sheet to RTL
      if (worksheet) {
        worksheet['!RTL'] = true;
      }
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");
      
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      resolve();
    }, 500);
  });
};

interface DistributionCounts {
  adahiRamthaDonor: number;
  adahiGaza: number;
  adahiFund: number;
  total: number;
}

export default function AdminDashboardPage() {
  const { allSubmissionsForAdmin, loading, refreshData } = useAuth(); 
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<AdahiSubmission[]>([]);
  const [distributionCounts, setDistributionCounts] = useState<DistributionCounts>({
    adahiRamthaDonor: 0,
    adahiGaza: 0,
    adahiFund: 0,
    total: 0,
  });

  useEffect(() => {
    const validSubmissions = allSubmissionsForAdmin.filter(sub => sub && sub.distributionPreference);
    setSubmissions(validSubmissions);

    if (validSubmissions.length > 0) {
      const counts = validSubmissions.reduce(
        (acc, sub) => {
          if (sub.distributionPreference === 'ramtha' || sub.distributionPreference === 'donor') {
            acc.adahiRamthaDonor += 1;
          } else if (sub.distributionPreference === 'gaza') {
            acc.adahiGaza += 1;
          } else if (sub.distributionPreference === 'fund') {
            acc.adahiFund += 1;
          }
          return acc;
        },
        { adahiRamthaDonor: 0, adahiGaza: 0, adahiFund: 0 }
      );
      setDistributionCounts({
        ...counts,
        total: validSubmissions.length
      });
    } else {
      setDistributionCounts({ adahiRamthaDonor: 0, adahiGaza: 0, adahiFund: 0, total: 0 });
    }
  }, [allSubmissionsForAdmin]);
  
  const handleDataChange = async () => {
     await refreshData(); 
  };

  const handleExportAll = async () => {
    if (submissions.length === 0) {
        toast({ title: "لا توجد بيانات لتصديرها.", variant: "destructive" });
        return;
    }
    toast({ title: "جاري تصدير جميع البيانات...", description: "سيتم تحميل ملف Excel (XLSX)." });
    await exportToXlsx(submissions, "all_adahi_submissions");
    toast({ title: "تم تصدير جميع البيانات بنجاح (Excel - XLSX).", description: "تحقق من مجلد التنزيلات." });
  };

  const handleExportByUser = async () => {
    if (submissions.length === 0) {
        toast({ title: "لا توجد بيانات لتصديرها.", variant: "destructive"});
        return;
    }
    toast({ title: "جاري تصدير البيانات حسب المستخدم...", description: "سيتم تحميل عدة ملفات Excel (XLSX)." });
    const submissionsByUser: { [key: string]: AdahiSubmission[] } = {};
    submissions.forEach(sub => {
      const userKey = sub.submitterUsername || sub.userEmail || sub.userId || "unknown_user"; 
      if (!submissionsByUser[userKey]) {
        submissionsByUser[userKey] = [];
      }
      submissionsByUser[userKey].push(sub);
    });

    for (const userKey in submissionsByUser) {
      await exportToXlsx(submissionsByUser[userKey], `adahi_submissions_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    toast({ title: "تم تصدير البيانات حسب المستخدم بنجاح (Excel - XLSX).", description: "تحقق من مجلد التنزيلات." });
  };
  
  return (
    <div className="space-y-10">
      <header className="space-y-2 pb-6 border-b">
        <h1 className="text-4xl font-bold tracking-tight">لوحة تحكم المدير</h1>
        <p className="text-lg text-muted-foreground">
          إدارة جميع الأضاحي المسجلة وتصدير البيانات وإحصائيات التوزيع.
        </p>
      </header>

      <section aria-labelledby="export-actions-heading">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Settings2 className="h-6 w-6 text-primary" />
              إجراءات التصدير
            </CardTitle>
            <CardDescription>
              تصدير بيانات الأضاحي المسجلة كملفات Excel (XLSX).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleExportAll} variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-md flex-1 sm:flex-initial">
                <FileDown className="ml-2 h-5 w-5" /> تصدير البيانات كاملة (Excel - XLSX)
              </Button>
              <Button onClick={handleExportByUser} variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-md flex-1 sm:flex-initial">
                <FileDown className="ml-2 h-5 w-5" /> تصدير البيانات حسب المستخدم (Excel - XLSX)
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="manage-submissions-heading" className="space-y-6">
         <div className="space-y-1">
            <h2 id="manage-submissions-heading" className="text-3xl font-semibold tracking-tight flex items-center gap-2">
                <TableIcon className="h-7 w-7 text-primary"/>
                إدارة الأضاحي
            </h2>
            <p className="text-muted-foreground">
                عرض وتعديل وحذف جميع الأضاحي المسجلة في النظام. إجمالي عدد الأضاحي: {distributionCounts.total}
            </p>
        </div>

        <Card className="shadow-md border border-border/50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              إحصائيات توزيع الأضاحي
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 border rounded-lg shadow-sm bg-secondary/30">
              <Archive className="h-8 w-8 mx-auto text-primary mb-2" data-ai-hint="livestock archive" />
              <p className="text-md font-semibold">أضاحي (الرمثا والمتبرع)</p>
              <p className="text-2xl font-bold text-primary">{distributionCounts.adahiRamthaDonor}</p>
            </div>
            <div className="p-4 border rounded-lg shadow-sm bg-secondary/30">
              <HandHelping className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <p className="text-md font-semibold">لأهل غزة</p>
              <p className="text-2xl font-bold text-green-600">{distributionCounts.adahiGaza}</p>
            </div>
            <div className="p-4 border rounded-lg shadow-sm bg-secondary/30">
              <PiggyBank className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <p className="text-md font-semibold">صندوق التضامن</p>
              <p className="text-2xl font-bold text-blue-600">{distributionCounts.adahiFund}</p>
            </div>
          </CardContent>
        </Card>
        
        <AdminSubmissionsTable submissions={submissions} onDataChange={handleDataChange} />
      </section>
    </div>
  );
}

