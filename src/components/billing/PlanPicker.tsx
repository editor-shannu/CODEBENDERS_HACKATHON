"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Key = "FREE" | "PRO_MONTH" | "PRO_YEAR" | "CENTRE_MONTH";
type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpCtor = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, f: (r: { error?: { description?: string } }) => void) => void };

const CARDS: { id: "FREE" | "PRO" | "CENTRE"; name: string; for: string; points: string[] }[] = [
  { id: "FREE", name: "Free", for: "Trying it with a small batch", points: ["Up to 10 students", "Who-owes board and WhatsApp reminders", "UPI QR invoices and parent pay links", "Parents join by link"] },
  { id: "PRO", name: "Baaki Pro", for: "A full-time home tutor", points: ["Unlimited students", "Munshi chat: type or speak, it does the entry", "WhatsApp group import and share-a-payment", "90-day cash forecast, rent risk and what-ifs", "Telugu, Hindi and English"] },
  { id: "CENTRE", name: "Centre", for: "2 to 5 teachers under one roof", points: ["Everything in Pro", "One login per teacher, one shared ledger", "Month report card for the owner", "Priority WhatsApp support"] },
];
const PRICE: Record<Key, { rupees: number; per: string }> = {
  FREE: { rupees: 0, per: "forever" },
  PRO_MONTH: { rupees: 99, per: "a month" },
  PRO_YEAR: { rupees: 999, per: "a year (2 months free)" },
  CENTRE_MONTH: { rupees: 299, per: "a month" },
};

function loadCheckout(): Promise<RzpCtor> {
  const w = window as unknown as { Razorpay?: RzpCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Checkout didn't load")));
    s.onerror = () => reject(new Error("Couldn't reach Razorpay. Check your internet and try again."));
    document.body.appendChild(s);
  });
}

/**
 * Pick a plan and pay with Razorpay Checkout (UPI, cards, netbanking). The server creates the order and
 * verifies the signature before the plan switches on. Signed-out visitors are sent to sign in first.
 */
export function PlanPicker({ signedIn, current, until, initial, dark = false }: { signedIn: boolean; current?: "FREE" | "PRO" | "CENTRE"; until?: string | null; initial?: Key; dark?: boolean }) {
  const [sel, setSel] = useState<Key>(initial ?? (current === "CENTRE" ? "CENTRE_MONTH" : "PRO_MONTH"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const cardOf = (k: Key) => (k === "FREE" ? "FREE" : k.startsWith("PRO") ? "PRO" : "CENTRE");

  const pay = async () => {
    setMsg(null);
    if (sel === "FREE") {
      if (!signedIn) router.push("/login?next=/home");
      else setMsg({ ok: true, text: current === "FREE" ? "You're on Free already." : "Your paid plan runs to its end date, then Baaki moves you to Free on its own." });
      return;
    }
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/settings/plan?plan=${sel}`)}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/billing/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: sel }) });
      const o = await res.json();
      if (!res.ok) throw new Error(o.error ?? "Couldn't start the payment.");
      const Rzp = await loadCheckout();
      const rzp = new Rzp({
        key: o.keyId,
        order_id: o.orderId,
        amount: o.amount,
        currency: "INR",
        name: "Baaki",
        description: o.label,
        prefill: { name: o.name, email: o.email },
        theme: { color: "#1b2444" },
        handler: async (r: RzpResponse) => {
          const v = await fetch("/api/billing/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
          const out = await v.json().catch(() => ({}));
          if (v.ok && out.ok) {
            setMsg({ ok: true, text: `Paid. ${out.plan === "CENTRE" ? "Centre" : "Pro"} is on until ${new Date(out.until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.` });
            router.refresh();
          } else setMsg({ ok: false, text: out.error ?? "Payment couldn't be verified." });
          setBusy(false);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", (r) => {
        setMsg({ ok: false, text: r.error?.description ?? "The payment failed. No money was taken." });
        setBusy(false);
      });
      rzp.open();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." });
      setBusy(false);
    }
  };

  const price = PRICE[sel];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="Choose a plan">
        {CARDS.map((c) => {
          const active = cardOf(sel) === c.id;
          const key: Key = c.id === "FREE" ? "FREE" : c.id === "CENTRE" ? "CENTRE_MONTH" : sel === "PRO_YEAR" ? "PRO_YEAR" : "PRO_MONTH";
          const pr = PRICE[key];
          return (
            <div
              key={c.id}
              role="radio"
              aria-checked={active}
              tabIndex={0}
              onClick={() => setSel(key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(key); } }}
              className={`ruled-paper cursor-pointer border p-5 text-left text-dusk-deep outline-none transition focus-visible:ring-2 focus-visible:ring-lamp ${active ? "border-4 border-brick" : "border-dusk-deep/20 hover:border-dusk-deep/60"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dusk-deep/70">{c.for}</p>
                {current === c.id && <span className="border border-[#1f7a4d] px-2 font-mono text-[10px] uppercase text-[#1f7a4d]">Your plan</span>}
              </div>
              <p className="mt-1 font-display text-3xl">{c.name}</p>
              <p className="big-number mt-2 text-5xl">₹{pr.rupees}</p>
              <p className="font-mono text-xs text-dusk-deep/70">{pr.per}</p>
              {c.id === "PRO" && (
                <div className="mt-3 inline-flex border border-dusk-deep/30 font-mono text-[11px] uppercase">
                  {(["PRO_MONTH", "PRO_YEAR"] as const).map((k) => (
                    <button key={k} type="button" onClick={(e) => { e.stopPropagation(); setSel(k); }} className={`min-h-9 px-3 ${sel === k ? "bg-dusk-deep text-plaster" : ""}`}>
                      {k === "PRO_MONTH" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>
              )}
              <ul className="mt-4 space-y-1 text-sm">{c.points.map((x) => <li key={x}>— {x}</li>)}</ul>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={pay} disabled={busy} className="inline-flex min-h-12 items-center border border-lamp bg-lamp px-5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-dusk-deep disabled:opacity-60">
          {busy ? "Opening checkout…" : sel === "FREE" ? (signedIn ? "Stay on Free" : "Start free") : `${signedIn ? "Pay" : "Sign in and pay"} ₹${price.rupees} · UPI or card`}
        </button>
        {until && current !== "FREE" && <span className={`font-mono text-xs ${dark ? "text-plaster/70" : "text-dusk-deep/70"}`}>Current plan runs until {until}.</span>}
      </div>
      {msg && <p role="status" className={`mt-3 font-mono text-sm ${msg.ok ? (dark ? "text-lamp" : "text-[#1f7a4d]") : "text-brick"}`}>{msg.text}</p>}
    </div>
  );
}
