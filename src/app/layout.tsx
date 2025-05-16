
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "تسجيل الأضاحي | Adahi Registration",
  description: "Manage Adahi submissions efficiently.",
  manifest: "/manifest.json", // إضافة رابط لملف المانيفست
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* يمكنك إبقاء <meta name="theme-color" ... /> هنا أو الاعتماد على ما في manifest.json */}
        <meta name="theme-color" content="#4CAF50" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" /> 
        {/* يمكنك إضافة المزيد من أيقونات apple-touch-icon بأحجام مختلفة إذا أردت */}
      </head>
      <body className={`${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <AuthProvider>
          <div className="flex-grow">
            {children}
          </div>
          <Toaster />
          <footer className="py-4 text-center text-sm text-muted-foreground border-t">
            حقوق الطبع © Haitham Salameh 2025
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
