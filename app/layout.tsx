import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEXUS Command Center",
  description: "Enterprise non-human identity and AI agent security posture",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased h-full`}>
      <body className="bg-[var(--color-background)] text-[var(--color-primary-text)] h-full flex text-sm overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-[var(--color-background)]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
