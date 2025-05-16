
"use client";

import AdahiSubmissionForm from "@/components/forms/AdahiSubmissionForm";
import UserSubmissionsTable from "@/components/tables/UserSubmissionsTable";
import { useAuth } from "@/hooks/useAuth";
// Removed useState and useEffect as currentSubmissions is no longer used
import type { AdahiSubmission } from "@/lib/types";
import { ListTree, Eye } from "lucide-react"; 

export default function DashboardPage() {
  const { user, submissions, loading, refreshData } = useAuth(); 
  // Removed currentSubmissions state and its useEffect

  const handleFormSubmit = () => {
    // refreshData from AuthContext is called within addSubmission,
    // which should trigger an update to the submissions list from useAuth.
    // If an explicit refresh is still needed here, it can be called.
    // For now, relying on AuthContext's refresh mechanism.
    // refreshData(); // Uncomment if needed after testing
  };

  return (
    <div className="space-y-6 md:space-y-8 p-2 sm:p-4">
      <header className="space-y-1 md:space-y-2 pb-3 md:pb-4 border-b text-center">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-primary">مركز الرمثا للخدمات المجتمعية</h1>
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-muted-foreground">اضاحي 2025</h2>
        <p className="text-xs sm:text-sm md:text-base text-muted-foreground pt-1">
          من خلال هذه الصفحة يمكنك إضافة أضحية جديدة أو الاطلاع على الأضاحي التي قمت بتسجيلها.
        </p>
      </header>

      <section aria-labelledby="new-submission-heading">
        <AdahiSubmissionForm onFormSubmit={handleFormSubmit} />
      </section>

      <section aria-labelledby="view-submissions-heading" className="space-y-4 md:space-y-6">
        <div className="space-y-1 text-center sm:text-right">
          <h2 id="view-submissions-heading" className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight flex items-center justify-center sm:justify-start gap-2">
            <Eye className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-primary" />
            الأضاحي المسجلة
          </h2>
          <p className="text-sm text-muted-foreground">
            قائمة بجميع الأضاحي التي قمت بإدخالها.
          </p>
        </div>
        {/* Directly pass submissions from useAuth */}
        <UserSubmissionsTable submissions={submissions} />
      </section>
    </div>
  );
}
