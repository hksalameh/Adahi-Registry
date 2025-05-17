
"use client";

import type { AdahiSubmission, DistributionPreference } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; 
import { distributionOptions } from "@/lib/types";

interface UserSubmissionsTableProps {
  submissions: AdahiSubmission[];
}

const getDistributionLabel = (value?: DistributionPreference | string) => {
  if (!value) return "غير محدد";
  return distributionOptions.find(opt => opt.value === value)?.label || String(value);
};

export default function UserSubmissionsTable({ submissions }: UserSubmissionsTableProps) {
  if (!submissions || submissions.length === 0) {
    return <p className="text-center text-muted-foreground mt-8">لا توجد أضاحي مسجلة حالياً من قبلك.</p>;
  }

  return (
    <div className="mt-8 rounded-lg border shadow-md overflow-x-auto">
      <Table>
        <TableCaption>قائمة الأضاحي المسجلة من قبلك. مجموع الأضاحي: {submissions.length}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">م</TableHead><TableHead>اسم المتبرع</TableHead><TableHead>الاضحية باسم</TableHead><TableHead>رقم التلفون</TableHead><TableHead>يريد الحضور</TableHead><TableHead>يريد من الأضحية</TableHead><TableHead>تم الدفع</TableHead><TableHead>توزع لـ</TableHead><TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub, index) => (
            <TableRow key={sub.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell className="font-medium whitespace-nowrap">{sub.donorName}</TableCell>
              <TableCell className="whitespace-nowrap">{sub.sacrificeFor}</TableCell>
              <TableCell className="whitespace-nowrap">{sub.phoneNumber}</TableCell>
              <TableCell className="whitespace-nowrap">{sub.wantsToAttend ? "نعم" : "لا"}</TableCell>
              <TableCell className="whitespace-nowrap">{sub.wantsFromSacrifice ? "نعم" : "لا"}</TableCell>
              <TableCell className="whitespace-nowrap">{sub.paymentConfirmed ? "نعم" : "لا"}</TableCell>
              <TableCell className="whitespace-nowrap">{getDistributionLabel(sub.distributionPreference)}</TableCell>
              <TableCell className="whitespace-nowrap">
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
