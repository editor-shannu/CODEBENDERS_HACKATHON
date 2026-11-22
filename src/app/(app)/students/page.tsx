import Link from "next/link";
import QRCode from "qrcode";
import { JoinInbox } from "@/components/join/JoinInbox";
import { ensureJoinCode, parseKids, suggestedFee } from "@/lib/join";
import { getOrigin } from "@/lib/origin";
import { Card, EmptyState, Eyebrow, PageHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { HouseStatus, houseStatusOf } from "@/components/ui/HouseStatus";
import { MoneyText } from "@/components/ui/MoneyText";
import { Guard } from "@/components/setup/Guard";
import { db } from "@/lib/db";
import { loadBoard } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function StudentsPage() {
  return (
    <Guard>
      {async () => {
        const students = await db.student.findMany({ include: { family: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
        const active = students.filter((s) => s.active);
        const board = await loadBoard();
        const code = await ensureJoinCode();
        const joinUrl = `${await getOrigin()}/join/${code}`;
        const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 240, color: { dark: "#1b2444", light: "#fbf6ea" } });
        const settings = await db.settings.findFirst({ select: { centreName: true } });
        const requests = await db.joinRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } });
        const joinRows = requests.map((r) => ({
          id: r.id,
          parentName: r.parentName,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
          kids: parseKids(r.kids).map((k) => ({ ...k, fee: suggestedFee(k.batch, students) })),
        }));
        const house = new Map(board.families.map((f) => [f.id, houseStatusOf(f.stats.balance, !!f.stats.openPromise)] as const));
        return (
          <div>
            <PageHeader title="Students" kicker={`${active.length} active · ${students.length - active.length} inactive`}>
              <LinkButton href="/students/new">Add student</LinkButton>
            </PageHeader>
            <Card className="mb-6">
              <Eyebrow className="mb-3">Parents add themselves{joinRows.length ? ` · ${joinRows.length} waiting` : ""}</Eyebrow>
              <JoinInbox url={joinUrl} qr={qr} centre={settings?.centreName ?? "our classes"} rows={joinRows} />
            </Card>
            {!students.length && <EmptyState title="No students yet" body="Share the join link above, import your WhatsApp group, or add a student by hand." />}
            <div className="space-y-6">
              {[...Array.from(new Set(active.map((s) => s.batch))).sort(), "Inactive"].map((batch) => {
                const list = batch === "Inactive" ? students.filter((s) => !s.active) : active.filter((s) => s.batch === batch);
                if (!list.length) return null;
                return (
                  <section key={batch}>
                    <Eyebrow className="mb-2">{batch} · {list.length}</Eyebrow>
                    <Card className="divide-y divide-dusk-deep/10 p-0">
                      {list.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                          <HouseStatus status={house.get(s.familyId) ?? "paid"} size={30} />
                          <div className="min-w-0">
                            <Link href={`/families/${s.familyId}`} className="font-display text-xl hover:text-brick">{s.name}</Link>
                            <p className="truncate font-mono text-[11px] text-dusk-deep/60">{s.family.parentName} · due on the {s.dueDay}</p>
                          </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <MoneyText amount={s.monthlyFee} className="text-sm" />
                            <Link href={`/students/${s.id}/edit`} className="font-mono text-[11px] uppercase tracking-widest text-dusk-deep/60 hover:text-brick">Edit</Link>
                          </div>
                        </div>
                      ))}
                    </Card>
                  </section>
                );
              })}
            </div>
          </div>
        );
      }}
    </Guard>
  );
}
