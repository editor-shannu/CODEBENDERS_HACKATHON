import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import BottomNav from "@/components/nav/BottomNav";
import { Main, TutorOnly } from "@/components/nav/TutorOnly";
import { getSettings } from "@/lib/data";
import { formatDate, todayIST } from "@/lib/dates";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap", axes: ["SOFT", "opsz"] });
const plexMono = IBM_Plex_Mono({ weight: ["400", "500", "600"], variable: "--font-plex-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Baaki",
  description: "Baaki: the back office for home tutors. Who owes, what's coming, and an AI clerk that chases for you.",
  applicationName: "Baaki",
  appleWebApp: { capable: true, title: "Baaki", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0E0E0E", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const today = formatDate(todayIST());
  return (
    <html lang="en" className={`${fraunces.variable} ${plexMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <TutorOnly>
        <header className="border-b border-plaster/15 px-4 py-3">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
            <Link href="/home" className="flex items-baseline gap-3">
              <span className="font-display text-2xl italic text-lamp">Baaki</span>
              <span className="hidden font-display text-lg sm:inline">{settings.centreName}</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs text-plaster/70">{today}</span>
              <Link href="/settings" className="font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/70 hover:text-lamp">
                Settings
              </Link>
            </div>
          </div>
        </header>
        </TutorOnly>
        <Main>{children}</Main>
        <TutorOnly>
        <footer className="px-4 pb-4 text-center font-mono text-[11px] text-slate-mute">
          {settings.centreName}, {settings.city} · Demo data (synthetic) · Built with Codebenders
        </footer>
        <div className="h-24" aria-hidden="true" />
        <BottomNav />
        </TutorOnly>
      </body>
    </html>
  );
}
