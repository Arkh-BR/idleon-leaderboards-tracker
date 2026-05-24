import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idleon Leaderboards Tracker",
  description:
    "Rastreie sua posição em todos os 153 leaderboards do IdleonToolbox.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
