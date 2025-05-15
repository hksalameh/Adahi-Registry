
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as a clean, readable font. Geist can be kept if preferred.
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "تسجيل الأضاحي | Adahi Registration",
  description: "Manage Adahi submissions efficiently.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
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
