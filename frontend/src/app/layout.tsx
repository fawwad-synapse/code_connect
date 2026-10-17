import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Navbar } from "@/components/Navbar";
import { OfflineBanner } from "@/components/OfflineBanner";

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
    <html lang="en" className="dark">
      <body className="font-sans bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        <OfflineBanner />
        <Navbar />
        <div className="flex-1 flex flex-col">{children}</div>
        <Toaster richColors position="top-right" theme="dark" />
      </body>
    </html>
  );
}
