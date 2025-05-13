
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6">
      <div className="space-y-4 w-full max-w-2xl">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-1/4" />
        <p className="text-center text-muted-foreground">جاري التحويل إلى لوحة التحكم...</p>
      </div>
    </div>
  );
}
