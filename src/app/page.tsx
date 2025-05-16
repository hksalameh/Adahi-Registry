
"use client";
/test
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth(); // Get user and loading state

  useEffect(() => {
    if (!loading) { // Only redirect when loading is finished
      if (user) {
        router.replace(user.isAdmin ? '/admin' : '/dashboard');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-background">
      <div className="space-y-4 w-full max-w-md text-center">
        <div className="animate-pulse">
          <svg className="mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">جاري تحميل التطبيق...</h1>
        <p className="text-muted-foreground">الرجاء الانتظار قليلاً.</p>
        <div className="pt-4 space-y-3">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-10 w-1/2 mx-auto" />
        </div>
      </div>
    </div>
  );
}
