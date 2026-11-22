import Link from "next/link";
import { PayLinkForm } from "@/components/landing/PayLinkForm";

export const dynamic = "force-dynamic";

/** Parents open the pay link their tutor sent. No family list here: one family's fee is never shown to another. */
export default function ParentPage() {
  return (
    <div className="mx-auto max-w-md">
      <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/70 hover:text-lamp">← Back</Link>
      <h1 className="mt-4 font-display text-4xl leading-none">Your child&apos;s fee</h1>
      <p className="mt-2 text-sm text-plaster/70">Paste the pay link your tutor sent on WhatsApp to see the fee and pay by UPI.</p>

      <div className="mt-6">
        <PayLinkForm />
      </div>
    </div>
  );
}
