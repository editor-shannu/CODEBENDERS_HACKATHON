import Link from "next/link";
import { Eyebrow } from "@/components/ui/Card";
import { HouseStatus, houseStatusOf } from "@/components/ui/HouseStatus";
import { PayLinkForm } from "@/components/landing/PayLinkForm";
import { loadBoard } from "@/lib/data";
import { dbHealth } from "@/lib/db-health";
import { balanceOf } from "@/lib/invoice-status";
import { kidsLabel } from "@/lib/messages";

export const dynamic = "force-dynamic";

/** Parents pick their family from the demo list, or paste their pay link. Flat and light. */
export default async function ParentPage() {
  const health = await dbHealth();
  let families: { id: string; name: string; kids: string; token: string; status: ReturnType<typeof houseStatusOf> }[] = [];
  if (health.ok) {
    const board = await loadBoard();
    families = board.families
      .map((f) => {
        const sorted = [...f.invoices].sort((a, b) => +a.dueDate - +b.dueDate);
        const inv = sorted.find((i) => balanceOf(i) > 0) ?? sorted[sorted.length - 1];
        return inv
          ? { id: f.id, name: f.parentName, kids: kidsLabel(f.students.filter((s) => s.active).map((s) => s.name)), token: inv.payToken, status: houseStatusOf(f.stats.balance, !!f.stats.openPromise) }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return (
    <div className="mx-auto max-w-md">
      <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/70 hover:text-lamp">← Back</Link>
      <h1 className="mt-4 font-display text-4xl leading-none">Your child&apos;s fee</h1>
      <p className="mt-2 text-sm text-plaster/70">Pick your family to see the fee and pay by UPI.</p>

      <div className="mt-6">
        <PayLinkForm />
      </div>

      <Eyebrow className="mt-8 mb-2">Demo families</Eyebrow>
      {families.length ? (
        <ul className="divide-y divide-plaster/15 border border-plaster/15">
          {families.map((f) => (
            <li key={f.id}>
              <Link href={`/pay/${f.token}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-plaster/5">
                <HouseStatus status={f.status} size={30} />
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg">{f.name}</span>
                  <span className="block truncate font-mono text-[11px] text-plaster/60">for {f.kids}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-plaster/60">The demo list isn&apos;t available right now. Paste your pay link above.</p>
      )}
    </div>
  );
}
