import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import BottomNav from "@/components/nav/BottomNav";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Baaki",
  description: "Baaki — fee tracking for Lakshmi Teaching Point",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return (
    <html lang="en" className={`${fraunces.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh flex flex-col pb-24">
        <header className="border-b border-ledger/20 px-4 py-4">
          <div className="mx-auto w-full max-w-5xl">
            <p className="font-display text-2xl">Lakshmi Teaching Point</p>
            <p className="font-mono text-sm text-ledger/70">{today}</p>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 mx-auto w-full max-w-5xl">{children}</main>
        <footer className="px-4 pb-3 text-center font-mono text-xs text-ink-muted">
          Demo data
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}

