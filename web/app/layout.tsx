import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idleon Leaderboards Tracker",
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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
