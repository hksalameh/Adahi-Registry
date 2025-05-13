
"use client";

import AdahiSubmissionForm from "@/components/forms/AdahiSubmissionForm";
import UserSubmissionsTable from "@/components/tables/UserSubmissionsTable";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import type { AdahiSubmission } from "@/lib/types";

export default function DashboardPage() {
  // user from useAuth will always be null now.
  const { submissions: initialSubmissions } = useAuth(); 
  const [currentSubmissions, setCurrentSubmissions] = useState<AdahiSubmission[]>(initialSubmissions);

  useEffect(() => {
    setCurrentSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  const handleFormSubmit = () => {
    // The submissions state in AuthContext should re-render the table automatically
    // due to onSnapshot. This callback can be used for other side effects if needed.
  };

  // if (!user) { // Removed this check as user is always null and page is public
  //   return <p className="text-center p-8">الرجاء تسجيل الدخول لعرض هذه الصفحة.</p>;
  // }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">لوحة التحكم</h1>
        <p className="text-muted-foreground">أضف أضحية جديدة أو اطلع على الأضاحي المسجلة.</p>
      </div>
      <AdahiSubmissionForm onFormSubmit={handleFormSubmit} />
      {/* UserSubmissionsTable will now display all submissions as AuthContext.submissions is updated */}
      <UserSubmissionsTable submissions={currentSubmissions} />
    </div>
  );
}
