"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Hides tutor chrome (header, nav, footer) on the public parent pay page. */
export function TutorOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/pay/")) return null;
  return <>{children}</>;
}
