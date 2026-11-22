"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Home, LineChart, Receipt, Users, Wallet, type LucideIcon } from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/owes", label: "Owes", icon: Wallet },
  { href: "/forecast", label: "Forecast", icon: LineChart },
  { href: "/munshi", label: "Munshi", icon: Bot },
  { href: "/students", label: "Students", icon: Users },
  { href: "/invoices", label: "Invoices", icon: Receipt },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-plaster/20 bg-dusk pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex w-full max-w-5xl justify-around">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wider sm:text-xs ${
                  active ? "text-lamp" : "text-plaster/70"
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

