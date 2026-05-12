"use client";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { 
  UserCog, Trash2, ShieldCheck, ShieldAlert, Settings2, TableIcon, 
  BarChart3, Coins, RefreshCw, Loader2, Users, FileText, Sheet, 
  UserPlus, ListChecks, ClipboardList, HandHelping 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
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

const PDF_MARGIN = 10; 

const AdminPage = () => {
  const { allSubmissionsForAdmin, loading: authLoading, refreshData, user, fetchUserById } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
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
      await updateDoc(doc(db, "users", userId), { isAdmin: !currentStatus, role: !currentStatus ? 'admin' : 'user' });
      fetchUsers();
      toast({ title: "تم تحديث الصلاحيات" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("سيتم حذف صلاحية الدخول لهذا المستخدم، هل أنت متأكد؟")) {
      await deleteDoc(doc(db, "users", userId));
      fetchUsers();
      toast({ title: "تم حذف المستخدم من القائمة" });
    }
  };

  useEffect(() => {
    if (isRegisterDialogOpen) {
      fetchUsers();
      setShowUserList(true);
    }
  }, [isRegisterDialogOpen]);

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
        toast({ title: "تنبيه إداري", description: `تم إضافة ${newSubmissionsCount} أضحية جديدة.` });
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
      });
    }
    return prepared;
  }, [getDistributionLabel, fetchUserById]);

  const exportToExcel = (dataToExportRaw: any[], fileName: string, sheetName: string, columnsToExport: Array<{header: string, dataKey: string}>) => {
    const worksheetData = dataToExportRaw.map(item => {
      const orderedItem: any = {};
      columnsToExport.forEach(col => { orderedItem[col.header] = item[col.dataKey] ?? ""; });
      return orderedItem;
    });
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };
  
  const generatePdfWithHtml2Pdf = async (title: string, data: any[], columns: Array<{header: string, dataKey: string}>, fileName: string, currentUserName?: string) => {
    setExportingType('pdf');
    try {
      let tableHtml = `<table style="width: 100%; border-collapse: collapse; direction: rtl;"><thead><tr>`;
      columns.forEach(col => { tableHtml += `<th style="border: 1px solid black; padding: 5px; background-color: #eee;">${col.header}</th>`; });
      tableHtml += `</tr></thead><tbody>`;
      data.forEach(item => {
        tableHtml += `<tr>`;
        columns.forEach(col => { tableHtml += `<td style="border: 1px solid black; padding: 5px; text-align: center;">${item[col.dataKey] ?? ""}</td>`; });
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody></table>`;

      const element = document.createElement('div');
      element.innerHTML = `<div style="direction: rtl; padding: 20px;"><h2>${title}</h2>${tableHtml}</div>`;
      await html2pdf().from(element).save(`${fileName}.pdf`);
      toast({ title: "تم التصدير بنجاح" });
    } catch (error) {
      toast({ title: "خطأ في التصدير", variant: "destructive" });
    } finally { setExportingType(null); }
  };

  const handleRegisterFormSubmit = () => { setIsRegisterDialogOpen(false); };

  if (authLoading || pageLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }

  const gazaCount = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'gaza').length;
  const ramthaCount = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'ramtha' || s.distributionPreference === 'donor').length;
  const fundCount = allSubmissionsForAdmin.filter(s => s.distributionPreference === 'fund').length;

  return (
    <div className="space-y-6 p-1">
      <header className="space-y-2 pb-4 border-b">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings2 /> إدارة الأضاحي</h1>
        <p className="text-muted-foreground">إجمالي: {allSubmissionsForAdmin.length} | غزة: {gazaCount} | رمثا: {ramthaCount} | تضامن: {fundCount}</p>
      </header>

      <section className="space-y-4">
        <Card>
          <CardHeader><CardTitle>إجراءات إدارية</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-blue-50 text-blue-700"><UserCog className="ml-2" />إدارة المستخدمين</Button>
              </DialogTrigger>
              <DialogContent className="max-w-[500px] max-h-[80vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>{showUserList ? "قائمة المستخدمين" : "إنشاء حساب جديد"}</DialogTitle>
                </DialogHeader>
                <div className="flex justify-center gap-4 mb-4 border-b pb-2">
                  <Button variant={showUserList ? "default" : "ghost"} onClick={() => setShowUserList(true)}>قائمة المستخدمين</Button>
                  <Button variant={!showUserList ? "default" : "ghost"} onClick={() => setShowUserList(false)}>إضافة مستخدم</Button>
                </div>
                {showUserList ? (
                  <div className="divide-y">
                    {usersList.map((u) => (
                      <div key={u.id} className="py-3 flex items-center justify-between">
                        <div><p className="font-bold">{u.username}</p><p className="text-xs">{u.email}</p></div>
                        <div className="flex gap-2">
                          <Button variant="ghost" onClick={() => toggleAdminStatus(u.id, u.isAdmin)}>
                            {u.isAdmin ? <ShieldCheck className="text-green-600" /> : <ShieldAlert className="text-gray-400" />}
                          </Button>
                          <Button variant="ghost" className="text-red-500" onClick={() => handleDeleteUser(u.id)}><Trash2 /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <RegisterForm isAdminCreator={true} onFormSubmit={handleRegisterFormSubmit} />}
              </DialogContent>
            </Dialog>
            <Button variant="outline" asChild><Link href="/dashboard"><ListChecks className="ml-2" />إدخال الأضاحي</Link></Button>
            <Button variant="outline" asChild><Link href="/slaughter"><ClipboardList className="ml-2" />إدارة الذبح</Link></Button>
          </CardContent>
        </Card>
      </section>

      <AdminSubmissionsTable submissions={allSubmissionsForAdmin} onDataChange={handleRefresh} />
    </div>
  );
}

export default AdminPage;
