import Link from "next/link";
import { Card, Eyebrow, PageHeader } from "@/components/ui/Card";
import { effectivePlan } from "@/lib/billing/plans";
import { Guard } from "@/components/setup/Guard";
import { BillsEditor, KeyDatesEditor, SettingsForm } from "@/components/settings/SettingsForms";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { formatDate, toKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <Guard>
      {async () => {
        const [s, bills, keyDates] = await Promise.all([
          getSettings(),
          db.bill.findMany({ orderBy: { dueDay: "asc" } }),
          db.keyDate.findMany({ orderBy: { startDate: "asc" } }),
        ]);
        return (
          <div className="space-y-6">
            <PageHeader title="Settings" kicker={s.centreName} />
            <Link href="/settings/plan" className="block">
              <Card className="flex items-center justify-between p-4 hover:border-brick">
                <div><Eyebrow>Plan</Eyebrow><p className="font-display text-2xl">{({ FREE: "Free", PRO: "Baaki Pro", CENTRE: "Centre" } as const)[effectivePlan(s as { plan?: string; planUntil?: Date | null })]}</p></div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-brick">Upgrade or renew →</span>
              </Card>
            </Link>
            <Card><Eyebrow className="mb-3">Centre and UPI</Eyebrow><SettingsForm s={s} /></Card>
            <Card><Eyebrow className="mb-3">Monthly bills</Eyebrow><BillsEditor bills={bills} /></Card>
            <Card>
              <Eyebrow className="mb-3">Key dates (festivals, exams)</Eyebrow>
              <KeyDatesEditor dates={keyDates.map((k) => ({ id: k.id, name: k.name, start: toKey(k.startDate), end: toKey(k.endDate), label: `${formatDate(k.startDate, { weekday: false, year: false })} to ${formatDate(k.endDate, { weekday: false, year: false })}`, factor: k.collectionFactor }))} />
            </Card>
          </div>
        );
      }}
    </Guard>
  );
}
