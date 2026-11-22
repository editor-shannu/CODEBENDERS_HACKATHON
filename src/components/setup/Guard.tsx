import type { ReactNode } from "react";
import { dbHealth } from "@/lib/db-health";
import { SetupNotice } from "./SetupNotice";

/** Renders children only when the database is ready; otherwise a setup screen instead of a 500. */
export async function Guard({ children }: { children: () => Promise<ReactNode> }) {
  const health = await dbHealth();
  if (!health.ok) return <SetupNotice health={health} />;
  return <>{await children()}</>;
}
