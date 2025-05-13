
"use client";

import AdahiSubmissionForm from "@/components/forms/AdahiSubmissionForm";
import UserSubmissionsTable from "@/components/tables/UserSubmissionsTable";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react"; // useEffect to re-fetch/re-filter submissions

export default function DashboardPage() {
  const { user, submissions: initialSubmissions } = useAuth();
  // Local state to manage submissions, possibly to trigger re-renders if AuthContext updates aren't immediate
  const [userSubmissions, setUserSubmissions] = useState(initialSubmissions);

  useEffect(() => {
    setUserSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  const handleFormSubmit = () => {
    // This function can be used to trigger a refresh of the submissions list if needed.
    // For now, AuthContext handles updates, so this might not be strictly necessary
    // but can be expanded if direct re-fetching is required.
    // Example: fetchUserSubmissions().then(setUserSubmissions);
    // The submissions state in AuthContext should re-render the table automatically.
  };

  if (!user) {
    // This should ideally be caught by the layout, but as a fallback.
    return <p className="text-center p-8">الرجاء تسجيل الدخول لعرض هذه الصفحة.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">لوحة التحكم الخاصة بك</h1>
        <p className="text-muted-foreground">أضف أضحية جديدة أو اطلع على أضاحيك المسجلة.</p>
      </div>
      <AdahiSubmissionForm onFormSubmit={handleFormSubmit} />
      <UserSubmissionsTable submissions={userSubmissions} />
    </div>
  );
}
