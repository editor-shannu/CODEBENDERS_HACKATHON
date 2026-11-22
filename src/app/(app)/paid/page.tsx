import { Card, PageHeader } from "@/components/ui/Card";
import { PasteMatch } from "@/components/actions/PasteMatch";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** "Someone paid": a shared screenshot or SMS lands here (?inbox=<id>) and is matched to the family that owes. */
export default async function PaidPage({ searchParams }: { searchParams: Promise<{ inbox?: string; error?: string }> }) {
  const { inbox, error } = await searchParams;
  const item = inbox ? await db.inboxItem.findFirst({ where: { id: inbox } }) : null;
  return (
    <div>
      <PageHeader title="Someone paid" kicker="Share a GPay or PhonePe screenshot, or a bank SMS, to Baaki. Munshi finds who paid." />
      {error === "too-big" && <p className="mb-3 font-mono text-xs text-brick">That file was too big. Try a smaller screenshot.</p>}
      <Card>
        <PasteMatch initialText={item?.kind === "PAYMENT_TEXT" ? item.text : ""} initialImage={item?.kind === "PAYMENT_IMAGE" ? item.image : ""} />
      </Card>
    </div>
  );
}
