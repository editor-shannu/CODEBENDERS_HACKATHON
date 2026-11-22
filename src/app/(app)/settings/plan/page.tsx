import type { Metadata } from "next";
import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui/Card";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { requireTutor } from "@/lib/auth/session";
import { rawDb } from "@/lib/prisma";
import { effectivePlan, FREE_STUDENT_LIMIT, isPlanKey } from "@/lib/billing/plans";
import { razorpayEnabled, razorpayTestMode } from "@/lib/billing/razorpay";
import { isDemoEmail } from "@/lib/demo";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan · Baaki" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { user, settings } = await requireTutor();
  const { plan } = await searchParams;
  const current = effectivePlan(settings);
  const [students, orders] = await Promise.all([
    rawDb.student.count({ where: { userId: user.id, active: true } }),
    rawDb.billingOrder.findMany({ where: { userId: user.id, status: "PAID" }, orderBy: { paidAt: "desc" }, take: 6 }),
  ]);
  const until = settings.planUntil && current !== "FREE" ? settings.planUntil.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : null;
  return (
    <div className="space-y-5">
      <div>
        <Link href="/settings" className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-70 hover:text-lamp">← Settings</Link>
        <h1 className="mt-2 font-display text-4xl leading-none">Your plan</h1>
        <p className="mt-2 text-sm opacity-80">
          {current === "FREE" ? `Free · ${students} of ${FREE_STUDENT_LIMIT} students used.` : `${current === "CENTRE" ? "Centre" : "Pro"} · ${students} students · runs until ${until}.`}
          {isDemoEmail(user.email) ? " Demo accounts have every feature on." : ""}
        </p>
      </div>
      {!razorpayEnabled() && (
        <Card className="p-4"><p className="text-sm">Payments aren&apos;t switched on for this server yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the environment.</p></Card>
      )}
      {razorpayEnabled() && razorpayTestMode() && (
        <p className="font-mono text-xs text-lamp">Test mode: use UPI ID success@razorpay or card 4111 1111 1111 1111. No real money moves.</p>
      )}
      <PlanPicker signedIn current={current} until={until} initial={isPlanKey(plan) ? plan : undefined} dark />
      {orders.length > 0 && (
        <Card className="p-4">
          <Eyebrow className="mb-2">Receipts</Eyebrow>
          <ul className="divide-y divide-dusk-deep/10 font-mono text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex justify-between py-2">
                <span>{o.plan.replace("_", " ").toLowerCase()} · {o.paidAt?.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                <span>{formatINR(o.amount / 100)} · {o.paymentId}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
