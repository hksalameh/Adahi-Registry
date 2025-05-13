
"use client";

import AdminSubmissionsTable from "@/components/tables/AdminSubmissionsTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { FileDown, Settings2, TableIcon } from "lucide-react"; // Added Settings2, TableIcon
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { AdahiSubmission } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Mock export function (replace with actual Excel export logic if library is added)
const exportToJson = (data: AdahiSubmission[], filename: string) => {
  console.log(`Exporting data to ${filename}.json:`, data);
  return new Promise<void>((resolve) => {
    setTimeout(() => { // Simulate async operation
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
    }, 500);
  });
};


export default function AdminDashboardPage() {
  const { allSubmissionsForAdmin } = useAuth(); 
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<AdahiSubmission[]>(allSubmissionsForAdmin);

  useEffect(() => {
    setSubmissions(allSubmissionsForAdmin);
  }, [allSubmissionsForAdmin]);
  
  const handleDataChange = () => {
     setSubmissions([...allSubmissionsForAdmin]); 
  };

  const handleExportAll = async () => {
    if (submissions.length === 0) {
        toast({ title: "لا توجد بيانات لتصديرها.", variant: "destructive" });
        return;
    }
    toast({ title: "جاري تصدير جميع البيانات...", description: "سيتم تحميل ملف JSON." });
    await exportToJson(submissions, "all_adahi_submissions");
    toast({ title: "تم تصدير جميع البيانات بنجاح (JSON).", description: "تحقق من مجلد التنزيلات." });
  };

  const handleExportByUser = async () => {
    if (submissions.length === 0) {
        toast({ title: "لا توجد بيانات لتصديرها.", variant: "destructive"});
        return;
    }
    toast({ title: "جاري تصدير البيانات حسب المستخدم...", description: "سيتم تحميل عدة ملفات JSON." });
    const submissionsByUser: { [key: string]: AdahiSubmission[] } = {};
    submissions.forEach(sub => {
      const userKey = sub.userEmail || sub.userId || "unknown_user"; 
      if (!submissionsByUser[userKey]) {
        submissionsByUser[userKey] = [];
      }
      submissionsByUser[userKey].push(sub);
    });

    for (const userKey in submissionsByUser) {
      await exportToJson(submissionsByUser[userKey], `adahi_submissions_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    toast({ title: "تم تصدير البيانات حسب المستخدم بنجاح (JSON).", description: "تحقق من مجلد التنزيلات." });
  };
  
  return (
    <div className="space-y-10">
      <header className="space-y-2 pb-6 border-b">
        <h1 className="text-4xl font-bold tracking-tight">لوحة تحكم المدير</h1>
        <p className="text-lg text-muted-foreground">
          إدارة جميع الأضاحي المسجلة وتصدير البيانات.
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
              تصدير بيانات الأضاحي المسجلة كملفات JSON.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleExportAll} variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-md flex-1 sm:flex-initial">
                <FileDown className="ml-2 h-5 w-5" /> تصدير البيانات كاملة (JSON)
              </Button>
              <Button onClick={handleExportByUser} variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-md flex-1 sm:flex-initial">
                <FileDown className="ml-2 h-5 w-5" /> تصدير البيانات حسب المستخدم (JSON)
              </Button>
            </div>
            <p className="text-sm text-muted-foreground pt-2">
              ملاحظة: يتم التصدير حاليًا كملفات JSON لأغراض تجريبية. لتصدير Excel، قد تحتاج إلى مكتبة إضافية.
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="manage-submissions-heading" className="space-y-6">
         <div className="space-y-1">
            <h2 id="manage-submissions-heading" className="text-3xl font-semibold tracking-tight flex items-center gap-2">
                <TableIcon className="h-7 w-7 text-primary"/> {/* Changed icon */}
                إدارة الأضاحي
            </h2>
            <p className="text-muted-foreground">
                عرض وتعديل وحذف جميع الأضاحي المسجلة في النظام.
            </p>
        </div>
        {/* AdminSubmissionsTable has its own card-like styling */}
        <AdminSubmissionsTable submissions={submissions} onDataChange={handleDataChange} />
      </section>
    </div>
  );
}
