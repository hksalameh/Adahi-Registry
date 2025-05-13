"use client";

import AdahiSubmissionForm from "@/components/forms/AdahiSubmissionForm";
import UserSubmissionsTable from "@/components/tables/UserSubmissionsTable";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import type { AdahiSubmission } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ListTree, Eye } from "lucide-react";

export default function DashboardPage() {
  const { submissions: initialSubmissions } = useAuth(); 
  const [currentSubmissions, setCurrentSubmissions] = useState<AdahiSubmission[]>(initialSubmissions);

  useEffect(() => {
    setCurrentSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  const handleFormSubmit = () => {
    // The submissions state in AuthContext should re-render the table automatically
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2 pb-6 border-b">
        <h1 className="text-4xl font-bold tracking-tight">سجل أضحية</h1>
        <p className="text-lg text-muted-foreground">
          أضف أضحية جديدة أو اطلع على الأضاحي المسجلة.
        </p>
      </header>

      <section aria-labelledby="new-submission-heading">
        {/* AdahiSubmissionForm is already a Card, no need to double wrap if CardHeader is used directly. */}
        {/* However, to give it a distinct section, wrapping or using a Card component is good. */}
        {/* The AdahiSubmissionForm component already uses a Card internally. */}
        <AdahiSubmissionForm onFormSubmit={handleFormSubmit} />
      </section>

      <section aria-labelledby="view-submissions-heading" className="space-y-6">
        <div className="space-y-1">
          <h2 id="view-submissions-heading" className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Eye className="h-7 w-7 text-primary" />
            الأضاحي المسجلة
          </h2>
          <p className="text-muted-foreground">
            قائمة بجميع الأضاحي التي قمت بإدخالها.
          </p>
        </div>
        {/* UserSubmissionsTable has its own card-like styling */}
        <UserSubmissionsTable submissions={currentSubmissions} />
      </section>
    </div>
  );
}
