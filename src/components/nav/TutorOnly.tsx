"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Public pages that never show tutor chrome: the landing, the parent picker and the parent pay page. */
export function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/parent" || pathname.startsWith("/pay/");
}

/** Hides tutor chrome (header, nav, footer) on public pages. */
export function TutorOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicPath(pathname)) return null;
  return <>{children}</>;
}

/** Page frame: the landing is full-bleed; every other page sits in the app column. */
export function Main({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return <main className="w-full flex-1">{children}</main>;
  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>;
}
