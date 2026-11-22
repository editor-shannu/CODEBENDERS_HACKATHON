import { PageHeader } from "@/components/ui/Card";
import { Guard } from "@/components/setup/Guard";
import { StudentForm } from "@/components/students/StudentForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewStudentPage({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
  const { family } = await searchParams;
  return (
    <Guard>
      {async () => {
        const families = await db.family.findMany({ select: { id: true, parentName: true }, orderBy: { parentName: "asc" } });
        return (
          <div>
            <PageHeader title="Add student" kicker="New admission" />
            <StudentForm families={families} defaultFamilyId={family} />
          </div>
        );
      }}
    </Guard>
  );
}
