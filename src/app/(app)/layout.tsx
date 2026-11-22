import type { ReactNode } from "react";
import { requireTutor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Every tutor page: only after a verified Google sign-in and a finished centre setup. */
export default async function TutorLayout({ children }: { children: ReactNode }) {
  await requireTutor();
  return <>{children}</>;
}
