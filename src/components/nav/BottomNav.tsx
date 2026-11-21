"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, Settings, Users, Wallet, type LucideIcon } from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/owes", label: "Owes", icon: Wallet },
  { href: "/students", label: "Students", icon: Users },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-ledger/20 bg-ink">
      <ul className="mx-auto flex w-full max-w-5xl justify-around">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 text-xs ${
                  active ? "text-turmeric" : "text-ledger/70"
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

