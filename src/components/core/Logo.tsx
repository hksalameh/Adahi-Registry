
import Link from "next/link";
import { HandHeart } from "lucide-react"; // Using an icon representing giving/charity

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
      <HandHeart className="h-7 w-7 sm:h-8 sm:w-8" />
      {/* النص الطويل الذي كان هنا تم إزالته لتحسين العرض على الهاتف */}
      {/* يمكنك إضافة نص أقصر هنا إذا أردت، مثال: 
      <h1 className="text-sm sm:text-lg md:text-xl font-bold text-destructive leading-tight">
        تسجيل الأضاحي
      </h1>
      */}
    </Link>
  );
}
