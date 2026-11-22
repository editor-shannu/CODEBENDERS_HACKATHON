import QRCode from "qrcode";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow } from "@/components/ui/Card";
import { Stamp } from "@/components/ui/Stamp";
import { Guard } from "@/components/setup/Guard";
import { RecordPaymentButton } from "@/components/actions/RecordPayment";
import { CopyButton, IssueDraftsButton, PrintButton } from "@/components/invoices/InvoiceActions";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { balanceOf, isOverdue, sumPaid } from "@/lib/invoice-status";
import { formatDate, formatMonth, todayIST, toKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { upiLink } from "@/lib/upi";
import { getOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

type Line = { name: string; batch: string; fee: number; discount: number };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Guard>
      {async () => {
        const inv = await db.invoice.findUnique({ where: { id }, include: { family: true, payments: { orderBy: { date: "asc" } } } });
        if (!inv) notFound();
        const settings = await getSettings();
        const today = todayIST();
        const bal = balanceOf(inv);
        const lines: Line[] = JSON.parse(inv.lines || "[]");
        const upi = upiLink({ vpa: settings.upiId, name: settings.upiName, amount: bal || inv.amount, note: `${inv.number} ${formatMonth(inv.month)}` });
        const qr = await QRCode.toDataURL(upi, { margin: 1, width: 240, color: { dark: "#1b2444", light: "#fbf6ea" } });
        const payUrl = `${await getOrigin()}/pay/${inv.payToken}`;
        return (
          <div>
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
              <Link href={`/families/${inv.familyId}`} className="font-mono text-xs text-plaster/70 hover:text-lamp">← {inv.family.parentName}</Link>
              <div className="flex flex-wrap gap-2">
                {inv.status === "DRAFT" ? <IssueDraftsButton ids={[inv.id]} label="Issue invoice" /> : <CopyButton text={payUrl} />}
                <PrintButton />
                {bal > 0 && inv.status !== "DRAFT" && <RecordPaymentButton invoiceId={inv.id} balance={bal} title={`${inv.family.parentName.split(" ")[0]} · ${formatMonth(inv.month)}`} today={toKey(today)} />}
              </div>
            </div>
            <article className="invoice-sheet ruled-paper relative mx-auto max-w-2xl border border-dusk-deep/15 p-6 text-dusk-deep md:p-8">
              <div className="absolute right-6 top-6">
                {bal === 0 ? <Stamp kind="PAID" className="text-2xl" /> : isOverdue(inv, today) ? <Stamp kind="OVERDUE" className="text-xl" /> : bal < inv.amount ? <Stamp kind="PARTIAL" className="text-xl" /> : null}
              </div>
              <Eyebrow>Fee invoice</Eyebrow>
              <h1 className="font-display text-3xl">{settings.centreName}</h1>
              <p className="font-mono text-xs text-dusk-deep/60">{settings.tutorName}</p>

              <div className="mt-6 grid grid-cols-2 gap-4 font-mono text-sm">
                <div><p className="text-[11px] uppercase tracking-widest text-dusk-deep/60">Billed to</p><p>{inv.family.parentName}</p></div>
                <div className="text-right"><p className="text-[11px] uppercase tracking-widest text-dusk-deep/60">Invoice</p><p>{inv.number}</p></div>
                <div><p className="text-[11px] uppercase tracking-widest text-dusk-deep/60">For</p><p>{formatMonth(inv.month, false)}</p></div>
                <div className="text-right"><p className="text-[11px] uppercase tracking-widest text-dusk-deep/60">Due</p><p>{formatDate(inv.dueDate)}</p></div>
              </div>

              <table className="mt-6 w-full font-mono text-sm">
                <thead>
                  <tr className="border-b border-dusk-deep/30 text-left text-[11px] uppercase tracking-widest text-dusk-deep/60"><th className="py-2">Student</th><th>Batch</th><th className="text-right">Fee</th></tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.name} className="border-b border-dusk-deep/10">
                      <td className="py-2">{l.name}</td>
                      <td className="text-xs">{l.batch}</td>
                      <td className="text-right">{formatINR(l.fee)}{l.discount ? <span className="block text-[11px] text-lamp">−{formatINR(l.discount)} sibling</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {inv.discount > 0 && <tr><td colSpan={2} className="pt-2">Sibling discount</td><td className="pt-2 text-right text-lamp">−{formatINR(inv.discount)}</td></tr>}
                  <tr><td colSpan={2} className="pt-2 font-semibold">Total</td><td className="pt-2 text-right font-semibold">{formatINR(inv.amount)}</td></tr>
                  {inv.payments.map((p) => (
                    <tr key={p.id} className="text-dusk-deep/70"><td colSpan={2}>Paid {formatDate(p.date)} · {p.mode}{p.reference ? ` · ${p.reference}` : ""}</td><td className="text-right">−{formatINR(p.amount)}</td></tr>
                  ))}
                  <tr className="border-t border-dusk-deep/30"><td colSpan={2} className="pt-2 text-lg font-semibold">Balance due</td><td className={`pt-2 text-right text-lg font-semibold ${bal ? "text-brick" : "text-lamp"}`}>{formatINR(bal)}</td></tr>
                </tfoot>
              </table>

              {bal > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-dusk-deep/15 pt-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="UPI QR code" width={160} height={160} className="border border-dusk-deep/20" />
                  <div className="font-mono text-sm">
                    <p className="text-[11px] uppercase tracking-widest text-dusk-deep/60">Scan with any UPI app</p>
                    <p className="mt-1">{settings.upiName}</p>
                    <p>{settings.upiId}</p>
                    <p className="mt-2 text-xs text-dusk-deep/60">Or pay online: {payUrl}</p>
                  </div>
                </div>
              )}
              <p className="mt-6 font-mono text-[11px] text-dusk-deep/50">Paid so far {formatINR(sumPaid(inv.payments))} · Generated {formatDate(today)}</p>
            </article>
          </div>
        );
      }}
    </Guard>
  );
}
