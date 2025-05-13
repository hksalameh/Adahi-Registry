
"use client";

// import { useAuth } from "@/hooks/useAuth"; // Auth checks removed
// import { useRouter } from "next/navigation"; // Auth checks removed
// import { useEffect } from "react"; // Auth checks removed
import Header from "@/components/core/Header";
// import { Skeleton } from "@/components/ui/skeleton"; // Skeleton removed

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const { user, loading } = useAuth(); // Auth checks removed
  // const router = useRouter(); // Auth checks removed

  // useEffect(() => { // Auth checks removed
  //   if (!loading) {
  //     if (!user) {
  //       router.push("/?redirect=/admin");
  //     } else if (!user.isAdmin) {
  //       router.push("/dashboard"); 
  //     }
  //   }
  // }, [user, loading, router]);

  // if (loading || !user || !user.isAdmin) { // Auth checks removed
  //    return (
  //     <div className="flex flex-col min-h-screen">
  //       <Header />
  //       <div className="flex-grow container mx-auto p-6 flex items-center justify-center">
  //           <div className="space-y-4 w-full max-w-2xl">
  //               <Skeleton className="h-12 w-1/2" />
  //               <Skeleton className="h-8 w-full" />
  //               <Skeleton className="h-32 w-full" />
  //               <Skeleton className="h-10 w-1/4" />
  //           </div>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
