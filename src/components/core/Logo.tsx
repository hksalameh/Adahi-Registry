
import Link from "next/link";
import { HandHeart } from "lucide-react"; // Using an icon representing giving/charity

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
      <HandHeart className="h-8 w-8" />
      <h1 className="text-2xl font-bold">تسجيل الأضاحي</h1>
    </Link>
  );
}
