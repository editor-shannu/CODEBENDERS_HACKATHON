import Link from "next/link";
import { Card, EmptyState, Eyebrow, PageHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { MoneyText } from "@/components/ui/MoneyText";
import { Guard } from "@/components/setup/Guard";
import { db } from "@/lib/db";
import { BATCHES } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default function StudentsPage() {
  return (
    <Guard>
      {async () => {
        const students = await db.student.findMany({ include: { family: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
        const active = students.filter((s) => s.active);
        return (
          <div>
            <PageHeader title="Students" kicker={`${active.length} active · ${students.length - active.length} inactive`}>
              <LinkButton href="/students/new">Add student</LinkButton>
            </PageHeader>
            {!students.length && <EmptyState title="No students yet" body="Add your first student to start tracking fees." />}
            <div className="space-y-6">
              {[...BATCHES, "Inactive"].map((batch) => {
                const list = batch === "Inactive" ? students.filter((s) => !s.active) : active.filter((s) => s.batch === batch);
                if (!list.length) return null;
                return (
                  <section key={batch}>
                    <Eyebrow className="mb-2">{batch} · {list.length}</Eyebrow>
                    <Card className="divide-y divide-dusk-deep/10 p-0">
                      {list.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <Link href={`/families/${s.familyId}`} className="font-display text-xl hover:text-brick">{s.name}</Link>
                            <p className="truncate font-mono text-[11px] text-dusk-deep/60">{s.family.parentName} · due on the {s.dueDay}</p>
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
