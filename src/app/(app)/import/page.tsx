import { Card, PageHeader } from "@/components/ui/Card";
import { ChatImport } from "@/components/import/ChatImport";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** WhatsApp group import. A shared chat file lands here with ?inbox=<id>. */
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ inbox?: string }> }) {
  const { inbox } = await searchParams;
  const shared = inbox ? await db.inboxItem.findFirst({ where: { id: inbox, kind: "CHAT" } }) : null;
  return (
    <div>
      <PageHeader title="Import WhatsApp group" kicker="Your parents' group already knows who's in your class and who paid" />
      <Card>
        <ChatImport initialText={shared?.text ?? ""} />
      </Card>
    </div>
  );
}
