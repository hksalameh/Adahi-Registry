
"use client";

import AdahiSubmissionForm from "@/components/forms/AdahiSubmissionForm";
import UserSubmissionsTable from "@/components/tables/UserSubmissionsTable";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import type { AdahiSubmission } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; 
import { ListTree, Eye } from "lucide-react"; 

export default function DashboardPage() {
  const { user, submissions: initialSubmissions, loading } = useAuth(); 
  const [currentSubmissions, setCurrentSubmissions] = useState<AdahiSubmission[]>(initialSubmissions);

  useEffect(() => {
    setCurrentSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  const handleFormSubmit = () => {
    // The submissions state in AuthContext should re-render the table automatically
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3 pb-6 border-b text-center sm:text-right">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">مركز الرمثا للخدمات المجتمعية</h1>
        <h2 className="text-xl sm:text-2xl font-semibold text-muted-foreground">اضاحي 2025</h2>
        <p className="text-md sm:text-lg text-muted-foreground pt-2">
          من خلال هذه الصفحة يمكنك إضافة أضحية جديدة أو الاطلاع على الأضاحي التي قمت بتسجيلها.
        </p>
      </header>

      <section aria-labelledby="new-submission-heading">
        <AdahiSubmissionForm onFormSubmit={handleFormSubmit} />
      </section>

      <section aria-labelledby="view-submissions-heading" className="space-y-6">
        <div className="space-y-1">
          <h2 id="view-submissions-heading" className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Eye className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            الأضاحي المسجلة
          </h2>
          <p className="text-muted-foreground">
            قائمة بجميع الأضاحي التي قمت بإدخالها.
          </p>
        </div>
        <UserSubmissionsTable submissions={currentSubmissions} />
      </section>
    </div>
  );
}
