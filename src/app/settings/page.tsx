import { Card, Eyebrow, PageHeader } from "@/components/ui/Card";
import { Guard } from "@/components/setup/Guard";
import { BillsEditor, KeyDatesEditor, ResetDemoButton, SettingsForm } from "@/components/settings/SettingsForms";
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
            <Card><Eyebrow className="mb-3">Centre and UPI</Eyebrow><SettingsForm s={s} /></Card>
            <Card><Eyebrow className="mb-3">Monthly bills</Eyebrow><BillsEditor bills={bills} /></Card>
            <Card>
              <Eyebrow className="mb-3">Key dates (festivals, exams)</Eyebrow>
              <KeyDatesEditor dates={keyDates.map((k) => ({ id: k.id, name: k.name, start: toKey(k.startDate), end: toKey(k.endDate), label: `${formatDate(k.startDate, { weekday: false, year: false })} to ${formatDate(k.endDate, { weekday: false, year: false })}`, factor: k.collectionFactor }))} />
            </Card>
            <Card variant="dusk" ruled={false}>
              <Eyebrow className="mb-2">Demo</Eyebrow>
              <p className="mb-3 text-sm opacity-80">Restores Lakshmi Teaching Point&apos;s 18 families, with every date shifted to today.</p>
              <ResetDemoButton />
            </Card>
          </div>
        );
      }}
    </Guard>
  );
}
