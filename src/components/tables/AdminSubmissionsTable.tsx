
"use client";

import type { AdahiSubmission } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle, Edit3, Trash2, MoreHorizontal, Eye, Phone, Users, CalendarDays, DollarSign, UserCircle, ListTree, Heart, MessageSquare, Receipt, FileText, CalendarCheck2, Loader2, Fingerprint, Mail, UserCog, User, NotebookText, Handshake } from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AdahiSubmissionForm from "@/components/forms/AdahiSubmissionForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { distributionOptions } from "@/lib/types";


interface AdminSubmissionsTableProps {
  submissions: AdahiSubmission[];
  onDataChange: () => void;
}

const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) {
    return 'N/A';
  }
  try {
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) {
      return 'تاريخ غير صالح';
    }
    return format(dateObj, "dd/MM/yyyy", { locale: arSA });
  } catch (error) {
    return 'خطأ في التاريخ';
  }
};

const formatDateTime = (dateString: string | undefined | null): string => {
  if (!dateString) {
    return 'N/A';
  }
  try {
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) {
      return 'تاريخ غير صالح';
    }
    return format(dateObj, "dd/MM/yyyy HH:mm", { locale: arSA });
  } catch (error) {
    return 'خطأ في التاريخ';
  }
};


export default function AdminSubmissionsTable({ submissions, onDataChange }: AdminSubmissionsTableProps) {
  const { updateSubmissionStatus, deleteSubmission, refreshData } = useAuth();
  const { toast } = useToast();
  const [editingSubmission, setEditingSubmission] = useState<AdahiSubmission | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);


  const handleStatusUpdate = async (id: string, newStatus: 'pending' | 'entered') => {
    setIsUpdatingStatus(id);
    const success = await updateSubmissionStatus(id, newStatus);
    if (success) {
      toast({ title: "تم تحديث الحالة بنجاح." });
      await refreshData(); 
    } else {
      toast({ title: "فشل تحديث الحالة.", variant: "destructive" });
    }
    setIsUpdatingStatus(null);
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    const success = await deleteSubmission(id);
    if (success) {
      toast({ title: "تم حذف السجل بنجاح." });
      await refreshData();
    } else {
      toast({ title: "فشل حذف السجل.", variant: "destructive" });
    }
    setIsDeleting(null);
  };

  const getDistributionLabel = (value?: string) => {
    if (!value) return "غير محدد";
    return distributionOptions.find(opt => opt.value === value)?.label || value;
  };

  if (!submissions || submissions.length === 0) {
    return <p className="text-center text-muted-foreground mt-8">لا توجد أضاحي مسجلة حالياً.</p>;
  }

  const closeEditDialog = async () => {
    setEditingSubmission(null);
    await refreshData();
  }

  return (
    <div className="mt-8 rounded-lg border shadow-md bg-card">
      <Table>
        <TableCaption>عرض جميع الأضاحي المسجلة. مجموع الأضاحي الكلي: {submissions.length}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>مدخل البيانات</TableHead>
            <TableHead>اسم المتبرع</TableHead>
            <TableHead>الأضحية عن</TableHead>
            <TableHead>رقم التلفون</TableHead>
            <TableHead>التاريخ</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead className="text-center">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <TableRow key={sub.id}>
              <TableCell>{sub.submitterUsername || sub.userEmail || sub.userId || "غير متوفر"}</TableCell>
              <TableCell className="font-medium">{sub.donorName}</TableCell>
              <TableCell>{sub.sacrificeFor}</TableCell>
              <TableCell>{sub.phoneNumber}</TableCell>
              <TableCell>
                {formatDate(sub.submissionDate)}
              </TableCell>
              <TableCell>
                <Badge variant={sub.status === "entered" ? "default" : "secondary"}
                       className={sub.status === "entered" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-yellow-400 hover:bg-yellow-500 text-black"}>
                  {sub.status === "entered" ? "مدخلة" : "غير مدخلة"}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Dialog open={editingSubmission?.id === sub.id} onOpenChange={(isOpen) => !isOpen && setEditingSubmission(null)}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-blue-600 hover:text-blue-800" onClick={() => setEditingSubmission(sub)}>
                            <Edit3 className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    {editingSubmission && editingSubmission.id === sub.id && (
                         <DialogContent className="sm:max-w-[600px] md:max-w-[800px]">
                            <DialogHeader>
                            <DialogTitle>تعديل بيانات الأضحية لـ: {editingSubmission.donorName}</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] p-2">
                                <AdahiSubmissionForm defaultValues={editingSubmission} isEditing={true} onFormSubmit={closeEditDialog} />
                            </ScrollArea>
                         </DialogContent>
                    )}
                </Dialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
                    <Dialog>
                        <DialogTrigger asChild>
                           <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" /> عرض التفاصيل
                           </DropdownMenuItem>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>تفاصيل أضحية: {sub.donorName}</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] p-1">
                            <div className="grid gap-3 py-4 text-sm">
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><Fingerprint className="inline-block ml-1 h-4 w-4"/>معرف السجل (ID):</strong> <p className="truncate font-mono text-xs" title={sub.id}>{sub.id}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><User className="inline-block ml-1 h-4 w-4"/>مدخل البيانات (Username):</strong> <p>{sub.submitterUsername || "غير متوفر"}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><UserCircle className="inline-block ml-1 h-4 w-4"/>معرف المستخدم (UserID):</strong> <p className="font-mono text-xs">{sub.userId || "غير متوفر"}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><Mail className="inline-block ml-1 h-4 w-4"/>البريد الإلكتروني للمستخدم:</strong> <p>{sub.userEmail || "غير متوفر"}</p></div>
                                <hr className="my-2 col-span-2"/>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><UserCircle className="inline-block ml-1 h-4 w-4"/>اسم المتبرع:</strong> <p>{sub.donorName}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><Heart className="inline-block ml-1 h-4 w-4"/>الأضحية عن:</strong> <p>{sub.sacrificeFor}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><Phone className="inline-block ml-1 h-4 w-4"/>رقم الهاتف:</strong> <p>{sub.phoneNumber}</p></div>
                                <hr className="my-2 col-span-2"/>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><CalendarCheck2 className="inline-block ml-1 h-4 w-4"/>يريد الحضور:</strong> <p>{sub.wantsToAttend ? "نعم" : "لا"}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><MessageSquare className="inline-block ml-1 h-4 w-4"/>يريد من الأضحية:</strong> <p>{sub.wantsFromSacrifice ? "نعم" : "لا"}</p></div>
                                {sub.wantsFromSacrifice && <div className="grid grid-cols-2 gap-2 items-center"><strong><NotebookText className="inline-block ml-1 h-4 w-4" /> ماذا يريد:</strong> <p>{sub.sacrificeWishes || "-"}</p></div>}
                                <hr className="my-2 col-span-2"/>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><DollarSign className="inline-block ml-1 h-4 w-4"/>تم الدفع:</strong> <p>{sub.paymentConfirmed ? "نعم" : "لا"}</p></div>
                                {sub.paymentConfirmed && (
                                <>
                                    <div className="grid grid-cols-2 gap-2 items-center"><strong><Receipt className="inline-block ml-1 h-4 w-4"/>رقم الدفتر:</strong> <p>{sub.receiptBookNumber || "-"}</p></div>
                                    <div className="grid grid-cols-2 gap-2 items-center"><strong><FileText className="inline-block ml-1 h-4 w-4"/>رقم السند:</strong> <p>{sub.voucherNumber || "-"}</p></div>
                                </>
                                )}
                                <hr className="my-2 col-span-2"/>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><Users className="inline-block ml-1 h-4 w-4"/>عن طريق وسيط:</strong> <p>{sub.throughIntermediary ? "نعم" : "لا"}</p></div>
                                {sub.throughIntermediary && <div className="grid grid-cols-2 gap-2 items-center"><strong><Handshake className="inline-block ml-1 h-4 w-4" />اسم الوسيط:</strong> <p>{sub.intermediaryName || "-"}</p></div>}
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><ListTree className="inline-block ml-1 h-4 w-4"/>توزع لـ:</strong> <p>{getDistributionLabel(sub.distributionPreference)}</p></div>
                                <hr className="my-2 col-span-2"/>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><CalendarDays className="inline-block ml-1 h-4 w-4"/>تاريخ التسجيل:</strong> <p>{formatDateTime(sub.submissionDate)}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><CalendarDays className="inline-block ml-1 h-4 w-4"/>آخر تحديث:</strong> <p>{formatDateTime(sub.lastUpdated)}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><UserCog className="inline-block ml-1 h-4 w-4"/>آخر تحديث بواسطة (إيميل):</strong> <p>{sub.lastUpdatedByEmail || "غير معروف"}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong><UserCog className="inline-block ml-1 h-4 w-4"/>معرف آخر محدث (ID):</strong> <p className="font-mono text-xs">{sub.lastUpdatedBy || "غير معروف"}</p></div>
                                <div className="grid grid-cols-2 gap-2 items-center"><strong>الحالة:</strong> <Badge variant={sub.status === "entered" ? "default" : "secondary"} className={sub.status === "entered" ? "bg-green-500 text-white" : "bg-yellow-400 text-black w-fit"}>{sub.status === "entered" ? "مدخلة" : "غير مدخلة"}</Badge></div>
                            </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleStatusUpdate(sub.id, sub.status === "pending" ? "entered" : "pending")}
                      className={sub.status === "pending" ? "text-green-600 cursor-pointer" : "text-yellow-600 cursor-pointer"}
                      disabled={isUpdatingStatus === sub.id}
                    >
                      {isUpdatingStatus === sub.id ? (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="ml-2 h-4 w-4" />
                      )}
                      {sub.status === "pending" ? "تأكيد الإدخال" : "إرجاع لـ (غير مدخلة)"}
                    </DropdownMenuItem>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive cursor-pointer" disabled={isDeleting === sub.id}>
                                {isDeleting === sub.id ? (
                                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                ) : (
                                 <Trash2 className="ml-2 h-4 w-4" />
                                )}
                                حذف
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                            <AlertDialogDescription>
                                هذا الإجراء لا يمكن التراجع عنه. سيتم حذف بيانات الأضحية للمتبرع "{sub.donorName}" بشكل دائم.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(sub.id)} className="bg-destructive hover:bg-destructive/90">
                                نعم، حذف
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

