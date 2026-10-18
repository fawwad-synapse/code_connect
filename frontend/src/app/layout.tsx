import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Navbar } from "@/components/Navbar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "RescueRank | Explainable Disaster Response Prioritization",
  description:
    "Prioritizing vulnerable populations and coordinating scarce rescue resources during urban floods in Karachi, Pakistan.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased min-h-screen flex flex-row bg-[#f1f5f9] text-slate-800">
        <PwaRegister />
        {/* Navbar component renders the left sidebar on dashboard, or top bar on other screens */}
        <Navbar />
        {/* Right / Main viewport area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <OfflineBanner />
          {children}
        </div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
