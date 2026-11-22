import QRCode from "qrcode";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Card";
import { Stamp } from "@/components/ui/Stamp";
import { HouseStatus } from "@/components/ui/HouseStatus";
import { Guard } from "@/components/setup/Guard";
import { PayClaim } from "@/components/invoices/PayClaim";
import { rawDb } from "@/lib/prisma";
import { balanceOf } from "@/lib/invoice-status";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { upiLink } from "@/lib/upi";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay tuition fee", robots: { index: false } };

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Guard>
      {async () => {
        // Public page: parents are not signed in, so it reads by the unguessable token only, never anything else.
        const inv = await rawDb.invoice.findUnique({ where: { payToken: token }, include: { family: { select: { parentName: true, students: { where: { active: true }, select: { name: true } } } }, payments: true, claims: { where: { status: "PENDING" } } } });
        // pay links only work once the invoice is issued
        if (!inv || inv.status === "DRAFT") notFound();
        const settings = await rawDb.settings.findUnique({ where: { userId: inv.userId }, select: { centreName: true, tutorName: true, upiId: true, upiName: true } });
        if (!settings) notFound();
        const bal = balanceOf(inv);
        const kids = inv.family.students.filter(() => true).map((s) => s.name.split(" ")[0]).join(", ");
        const upi = upiLink({ vpa: settings.upiId, name: settings.upiName, amount: bal, note: `${inv.number} ${kids}` });
        const qr = bal > 0 ? await QRCode.toDataURL(upi, { margin: 1, width: 260, color: { dark: "#1b2444", light: "#fbf6ea" } }) : null;
        return (
          <div className="mx-auto max-w-md">
            <p className="mb-4 text-center font-display text-2xl italic text-lamp">{settings.centreName}</p>
            <div className="ruled-paper relative border border-dusk-deep/15 p-6 text-dusk-deep">
              <Eyebrow>Tuition fee · {formatMonth(inv.month, false)}</Eyebrow>
              <h1 className="mt-1 font-display text-3xl leading-tight">Namaste {inv.family.parentName.split(" ")[0]} garu</h1>
              <p className="text-sm text-dusk-deep/70">for {kids}</p>
              {bal === 0 ? (
                <div className="my-8 text-center">
                  <div className="mb-4 flex justify-center">
                    <HouseStatus status="paid" size={56} />
                  </div>
                  <Stamp kind="PAID" className="text-3xl" />
                  <p className="mt-4 font-mono text-sm">Fully paid. Thank you!</p>
                </div>
              ) : (
                <>
                  <p className="big-number mt-4 text-5xl text-brick">{formatINR(bal)}</p>
                  <p className="font-mono text-xs text-dusk-deep/60">Due {formatDate(inv.dueDate)} · {inv.number}</p>
                  {qr && (
                    <div className="my-5 flex flex-col items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt="UPI QR code" width={200} height={200} className="border border-dusk-deep/20" />
                      <p className="mt-2 font-mono text-xs">{settings.upiName} · {settings.upiId}</p>
                    </div>
                  )}
                  {inv.claims.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <HouseStatus status="promised" size={56} />
                      </div>
                      <p className="border border-lamp p-3 text-center font-mono text-sm">We got your payment note. {settings.tutorName.split(" ")[0]} garu will confirm soon.</p>
                    </div>
                  ) : (
                    <PayClaim token={token} balance={bal} upi={upi} />
                  )}
                </>
              )}
            </div>
            <p className="mt-4 text-center font-mono text-[11px] text-plaster/50">Payments go directly to {settings.tutorName}&apos;s UPI. Baaki never handles your money.</p>
          </div>
        );
      }}
    </Guard>
  );
}
