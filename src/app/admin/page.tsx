
"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Settings2, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import type { AdahiSubmission } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminSubmissionsTable from "@/components/tables/AdminSubmissionsTable";

export default function AdminPage() {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, user } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    // ننتظر حتى تنتهي عملية التحقق من المصادقة الأولية
    if (!authLoading) {
      if (user && user.isAdmin) {
        // إذا كان المستخدم مديرًا، نقوم بتحميل البيانات
        handleRefresh().finally(() => setPageLoading(false));
      } else {
        // إذا لم يكن المستخدم مديرًا أو لا يوجد مستخدم، نتوقف عن التحميل
        // يفترض أن AdminLayout قد قام بإعادة التوجيه بالفعل
        setPageLoading(false);
      }
    }
  }, [authLoading, user, refreshData]); // أضفت refreshData إلى قائمة الاعتماديات

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
    toast({ title: "تم تحديث البيانات" });
  };

  // عرض شاشة تحميل أثناء التحقق من المصادقة أو تحميل بيانات الصفحة
  if (authLoading || pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">جاري تحميل صفحة الإدارة...</p>
      </div>
    );
  }

  // AdminLayout يجب أن يمنع غير المديرين من الوصول إلى هنا.
  // ولكن كإجراء احترازي إضافي:
  if (!user || !user.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <p className="text-destructive text-center">غير مصرح لك بالدخول لهذه الصفحة. يتم توجيهك...</p>
      </div>
    );
  }

  // إحصائيات مبسطة مؤقتًا
  const stats = {
    total: allSubmissionsForAdmin.length,
    gaza: allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza').length,
    ramthaAndDonor: allSubmissionsForAdmin.filter(s => s.distributionPreference === 'ramtha' || s.distributionPreference === 'donor').length,
    fund: allSubmissionsForAdmin.filter(s => s.distributionPreference === 'fund').length,
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2 pb-6 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-7 w-7 text-primary" />
          إدارة الأضاحي
        </h1>
        <p className="text-lg text-muted-foreground">
          عرض وتعديل وحذف جميع الأضاحي المسجلة في النظام.
        </p>
      </header>

      <section aria-labelledby="stats-heading" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأضاحي</CardTitle>
            {/* أيقونة محذوفة مؤقتًا */}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أضاحي للرمثا والمتبرعين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ramthaAndDonor}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أضاحي لأهل غزة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.gaza}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">لصندوق التضامن</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fund}</div>
          </CardContent>
        </Card>
      </section>
      
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-semibold">جدول الإدخالات</h2>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing || authLoading}>
            {isRefreshing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
            تحديث البيانات
          </Button>
          {/* زر التصدير محذوف مؤقتًا
          <Button onClick={exportToExcel} variant="default" disabled={isExporting || allSubmissionsForAdmin.length === 0}>
            {isExporting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Download className="ml-2 h-4 w-4" />}
            تصدير إلى Excel
          </Button>
          */}
        </div>
      </div>
      
      <AdminSubmissionsTable submissions={allSubmissionsForAdmin} onDataChange={handleRefresh} />
    </div>
  );
}
