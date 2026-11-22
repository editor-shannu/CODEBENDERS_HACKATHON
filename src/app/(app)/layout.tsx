import type { ReactNode } from "react";
import { requireTutor } from "@/lib/auth/session";
import { isDemoEmail } from "@/lib/demo";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { MunshiChat } from "@/components/munshi/MunshiChat";
import { OfflineSupport } from "@/components/offline/OfflineSupport";

export const dynamic = "force-dynamic";

/** Every tutor page: only after a sign-in (or a demo account) and a finished centre setup. */
export default async function TutorLayout({ children }: { children: ReactNode }) {
  const { user } = await requireTutor();
  return (
    <>
      {isDemoEmail(user.email) && <DemoBanner />}
      <OfflineSupport />
      {children}
      <div className="h-20" aria-hidden="true" />
      <MunshiChat ephemeral={isDemoEmail(user.email)} />
    </>
  );
}
