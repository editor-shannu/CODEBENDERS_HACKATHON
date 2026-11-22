import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Pricing · Baaki" };

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    per: "forever",
    for: "Trying it with a small batch",
    points: ["Up to 10 students", "Who-owes board and WhatsApp reminders", "UPI QR invoices and parent pay links", "Parents join by link"],
  },
  {
    name: "Baaki Pro",
    price: "₹99",
    per: "a month, or ₹999 a year",
    for: "A full-time home tutor",
    points: ["Unlimited students", "Munshi chat: type or speak, it does the entry", "WhatsApp group import and share-a-payment", "90-day cash forecast, rent risk and what-ifs", "Telugu, Hindi and English"],
    pick: true,
  },
  {
    name: "Centre",
    price: "₹299",
    per: "a month",
    for: "2 to 5 teachers under one roof",
    points: ["Everything in Pro", "One login per teacher, one shared ledger", "Month report card for the owner", "Priority WhatsApp support"],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl py-10 text-plaster">
      <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/70 hover:text-lamp">← Baaki</Link>
      <h1 className="mt-4 font-display text-5xl leading-none text-lamp">One late fee pays for a year.</h1>
      <p className="mt-3 max-w-2xl text-plaster/80">
        A tutor with 25 students at ₹2,000 has ₹50,000 a month riding on a notebook. If Baaki gets just one late family to pay on time, Pro has paid for itself ten times over. Pay by UPI AutoPay. Cancel any time.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={`ruled-paper border p-5 text-dusk-deep ${p.pick ? "border-4 border-brick" : "border-dusk-deep/20"}`}>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dusk-deep/70">{p.for}</p>
            <p className="mt-1 font-display text-3xl">{p.name}</p>
            <p className="big-number mt-2 text-5xl">{p.price}</p>
            <p className="font-mono text-xs text-dusk-deep/70">{p.per}</p>
            <ul className="mt-4 space-y-1 text-sm">
              {p.points.map((x) => <li key={x}>— {x}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 text-sm text-plaster/80 md:grid-cols-3">
        <p><span className="font-display text-xl text-lamp">Who pays.</span><br />The tutor, from the fees Baaki helps collect. No cost to parents, ever.</p>
        <p><span className="font-display text-xl text-lamp">Why switch.</span><br />A notebook can&apos;t remind, can&apos;t forecast rent, and can&apos;t read a GPay screenshot. Baaki starts from the WhatsApp group they already run.</p>
        <p><span className="font-display text-xl text-lamp">How it grows.</span><br />Every pay link and join link a parent opens shows Baaki to another tutor in the same colony.</p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href="/api/demo" className="inline-flex min-h-12 items-center border border-lamp bg-lamp px-5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-dusk-deep">Try the demo</a>
        <Link href="/login" className="inline-flex min-h-12 items-center border border-plaster/40 px-5 font-mono text-xs uppercase tracking-[0.14em]">Start free</Link>
      </div>
      <p className="mt-6 font-mono text-[11px] text-plaster/50">Launch pricing. Payments aren&apos;t switched on in this hackathon build.</p>
    </div>
  );
}
