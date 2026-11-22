import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, Eyebrow } from "@/components/ui/Card";
import { SettingsForm } from "@/components/settings/SettingsForms";
import { SignOutButton } from "@/components/auth/GoogleSignIn";
import { rawDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your centre · Baaki", robots: { index: false } };

/** First sign-in: the tutor names their centre and UPI before the dashboard opens. */
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  if (await rawDb.settings.findUnique({ where: { userId: user.id }, select: { userId: true } })) redirect("/home");
  const first = user.name.split(" ")[0] || "there";
  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="flex items-center justify-between">
        <p className="font-display text-3xl leading-none text-lamp">Baaki</p>
        <SignOutButton className="font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/70 hover:text-lamp" />
      </div>
      <h1 className="mt-6 font-display text-4xl leading-none">Namaste, {first}</h1>
      <p className="mt-2 text-sm text-plaster/70">Signed in as {user.email}. Tell Baaki about your centre; parents see these on their pay page.</p>
      <Card className="mt-6">
        <Eyebrow className="mb-3">Centre and UPI</Eyebrow>
        <SettingsForm
          s={{ tutorName: user.name, centreName: "", upiId: "", upiName: user.name, startingBalance: 0, autonomy: "ASK", monthlyGoal: 0 }}
          next="/home"
          submitLabel="Open my dashboard"
        />
      </Card>
    </div>
  );
}
