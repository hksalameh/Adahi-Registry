
import Link from "next/link";
import { HandHeart } from "lucide-react"; // Using an icon representing giving/charity

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
      <HandHeart className="h-7 w-7 sm:h-8 sm:w-8" />
      <h1 className="text-md sm:text-xl font-bold text-destructive">
        مَنْ وَجَدَ سَعَةً وَلَمْ يُضَحِّ، فَلَا يَقْرَبَنَّ مُصَلَّانَا.
      </h1>
    </Link>
  );
}
