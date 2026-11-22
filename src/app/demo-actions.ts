"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoEmail } from "@/lib/demo";
import { seedDemo } from "@/lib/demo-seed";

/** Puts a demo account back to its starting story. Refused for real accounts. */
export async function resetDemoAction() {
  const user = await getSessionUser();
  if (!user || !isDemoEmail(user.email)) return;
  await seedDemo(user.id);
  revalidatePath("/", "layout");
}
