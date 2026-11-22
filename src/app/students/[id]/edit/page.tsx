import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/Card";
import { Guard } from "@/components/setup/Guard";
import { StudentForm } from "@/components/students/StudentForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Guard>
      {async () => {
        const student = await db.student.findUnique({ where: { id }, include: { family: true } });
        if (!student) notFound();
        return (
          <div>
            <PageHeader title={student.name} kicker={`${student.family.parentName}'s family${student.active ? "" : " · inactive"}`} />
            <StudentForm families={[]} student={student} />
          </div>
        );
      }}
    </Guard>
  );
}
