
"use client";

import type { AdahiSubmission } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns"; 
import { arSA } from "date-fns/locale"; 

interface UserSubmissionsTableProps {
  submissions: AdahiSubmission[];
}

const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) {
    return 'N/A';
  }
  try {
    const dateObj = new Date(dateString);
    // Check if dateObj is a valid date
    if (isNaN(dateObj.getTime())) {
      console.warn("Invalid date string encountered in UserSubmissionsTable:", dateString);
      return 'تاريخ غير صالح';
    }
    return format(dateObj, "dd/MM/yyyy", { locale: arSA });
  } catch (error) {
    console.error("Error formatting date in UserSubmissionsTable:", dateString, error);
    return 'خطأ في التاريخ';
  }
};

export default function UserSubmissionsTable({ submissions }: UserSubmissionsTableProps) {
  if (!submissions || submissions.length === 0) {
    return <p className="text-center text-muted-foreground mt-8">لا توجد أضاحي مسجلة حالياً.</p>;
  }

  return (
    <div className="mt-8 rounded-lg border shadow-md overflow-x-auto">
      <Table>
        <TableCaption>قائمة الأضاحي المسجلة من قبلك. مجموع الأضاحي: {submissions.length}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>اسم المتبرع</TableHead>
            <TableHead>الأضحية باسم</TableHead>
            <TableHead>رقم التلفون</TableHead>
            <TableHead>يريد الحضور</TableHead>
            <TableHead>التاريخ</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <TableRow key={sub.id}>
              <TableCell className="font-medium">{sub.donorName}</TableCell>
              <TableCell>{sub.sacrificeFor}</TableCell>
              <TableCell>{sub.phoneNumber}</TableCell>
              <TableCell>{sub.wantsToAttend ? "نعم" : "لا"}</TableCell>
              <TableCell>
                {formatDate(sub.submissionDate)}
              </TableCell>
              <TableCell>
                <Badge variant={sub.status === "entered" ? "default" : "secondary"} 
                       className={sub.status === "entered" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-yellow-400 hover:bg-yellow-500 text-black"}>
                  {sub.status === "entered" ? "مدخلة" : "غير مدخلة"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

