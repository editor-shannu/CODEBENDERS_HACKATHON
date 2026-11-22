import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { PlanPicker } from "@/components/billing/PlanPicker";

export const metadata: Metadata = { title: "Pricing · Baaki" };


export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getSessionUser().catch(() => null);
  return (
    <div className="mx-auto max-w-5xl py-10 text-plaster">
      <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/70 hover:text-lamp">← Baaki</Link>
      <h1 className="mt-4 font-display text-5xl leading-none text-lamp">One late fee pays for a year.</h1>
      <p className="mt-3 max-w-2xl text-plaster/80">
        A tutor with 25 students at ₹2,000 has ₹50,000 a month riding on a notebook. If Baaki gets just one late family to pay on time, Pro has paid for itself ten times over. Pay by UPI AutoPay. Cancel any time.
      </p>
      <div className="mt-8">
        <PlanPicker signedIn={!!user} dark />
      </div>
      <div className="mt-8 grid gap-4 text-sm text-plaster/80 md:grid-cols-3">
        <p><span className="font-display text-xl text-lamp">Who pays.</span><br />The tutor, from the fees Baaki helps collect. No cost to parents, ever.</p>
        <p><span className="font-display text-xl text-lamp">Why switch.</span><br />A notebook can&apos;t remind, can&apos;t forecast rent, and can&apos;t read a GPay screenshot. Baaki starts from the WhatsApp group they already run.</p>
        <p><span className="font-display text-xl text-lamp">How it grows.</span><br />Every pay link and join link a parent opens shows Baaki to another tutor in the same colony.</p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href="/api/demo" className="inline-flex min-h-12 items-center border border-lamp bg-lamp px-5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-dusk-deep">Try the demo</a>
      </div>
      <p className="mt-6 font-mono text-[11px] text-plaster/50">Payments by Razorpay: UPI, cards and netbanking. Baaki never sees your card or UPI PIN.</p>
    </div>
  );
}
