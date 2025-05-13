
"use client";

import AdminSubmissionsTable from "@/components/tables/AdminSubmissionsTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { AdahiSubmission } from "@/lib/types";

// Mock export function (replace with actual Excel export logic if library is added)
const exportToExcel = (data: AdahiSubmission[], filename: string) => {
  console.log(`Exporting data to ${filename}.xlsx:`, data);
  // Placeholder: In a real app, use a library like 'xlsx' here.
  // For example:
  // const worksheet = XLSX.utils.json_to_sheet(data);
  // const workbook = XLSX.utils.book_new();
  // XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");
  // XLSX.writeFile(workbook, `${filename}.xlsx`);
  return new Promise<void>((resolve) => {
    setTimeout(() => { // Simulate async operation
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`; // Downloading as JSON for mock
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
    }, 500);
  });
};


export default function AdminDashboardPage() {
  const { user, allSubmissionsForAdmin } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<AdahiSubmission[]>(allSubmissionsForAdmin);

  useEffect(() => {
    setSubmissions(allSubmissionsForAdmin);
  }, [allSubmissionsForAdmin]);
  
  const handleDataChange = () => {
     setSubmissions([...allSubmissionsForAdmin]); // Create new array ref to trigger re-render
  };

  const handleExportAll = async () => {
    toast({ title: "جاري تصدير جميع البيانات..." });
    await exportToExcel(submissions, "all_adahi_submissions");
    toast({ title: "تم تصدير جميع البيانات بنجاح (JSON mock)." });
  };

  const handleExportByUser = async () => {
    if (submissions.length === 0) {
        toast({ title: "لا توجد بيانات لتصديرها."});
        return;
    }
    toast({ title: "جاري تصدير البيانات حسب المستخدم..." });
    const submissionsByUser: { [key: string]: AdahiSubmission[] } = {};
    submissions.forEach(sub => {
      const userKey = sub.userEmail || sub.userId;
      if (!submissionsByUser[userKey]) {
        submissionsByUser[userKey] = [];
      }
      submissionsByUser[userKey].push(sub);
    });

    for (const userKey in submissionsByUser) {
      await exportToExcel(submissionsByUser[userKey], `adahi_submissions_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    toast({ title: "تم تصدير البيانات حسب المستخدم بنجاح (JSON mock)." });
  };

  if (!user || !user.isAdmin) {
    return <p className="text-center p-8">ليس لديك صلاحية الوصول لهذه الصفحة.</p>;
  }
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">لوحة تحكم المدير</h1>
        <p className="text-muted-foreground">إدارة جميع الأضاحي المسجلة وتصدير البيانات.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button onClick={handleExportAll} variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <FileDown className="ml-2 h-5 w-5" /> تصدير البيانات كاملة (Excel)
        </Button>
        <Button onClick={handleExportByUser} variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <FileDown className="ml-2 h-5 w-5" /> تصدير البيانات حسب المستخدم (Excel)
        </Button>
      </div>
      <AdminSubmissionsTable submissions={submissions} onDataChange={handleDataChange} />
    </div>
  );
}
