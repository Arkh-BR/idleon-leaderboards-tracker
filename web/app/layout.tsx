import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";

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
    <html lang="en">
      <body className="min-h-screen">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
