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
    default: "Idleon Trackers",
    template: "%s | Idleon Trackers",
  },
  description:
    "Community trackers for Legends of Idleon — leaderboards rank monitor and a local Tome Score calculator.",
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
