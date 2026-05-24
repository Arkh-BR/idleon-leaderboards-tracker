import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "IdleonToolbox Leaderboards Tracker",
    template: "%s | IdleonToolbox Tracker",
  },
  description:
    "Track your position across all 153 IdleonToolbox leaderboards.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
