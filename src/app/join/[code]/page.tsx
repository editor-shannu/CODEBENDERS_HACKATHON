import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Card";
import { Guard } from "@/components/setup/Guard";
import { JoinForm } from "@/components/join/JoinForm";
import { centreForCode } from "@/lib/join";
import { rawDb } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join the class · Baaki", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <Guard>
      {async () => {
        const centre = await centreForCode(code);
        if (!centre) notFound();
        // only batch names are shown, never another family's details
        const batches = (await rawDb.student.findMany({ where: { userId: centre.userId, active: true }, select: { batch: true }, distinct: ["batch"] })).map((b) => b.batch);
        return (
          <div className="mx-auto max-w-md">
            <p className="mb-4 text-center font-display text-2xl italic text-lamp">{centre.centreName}</p>
            <div className="ruled-paper border border-dusk-deep/15 p-6 text-dusk-deep">
              <Eyebrow>Join the class{centre.city ? ` · ${centre.city}` : ""}</Eyebrow>
              <h1 className="mt-1 font-display text-3xl leading-tight">Add your child in 20 seconds</h1>
              <p className="mb-5 mt-1 text-sm text-dusk-deep/70">{centre.tutorName || "Your tutor"} will confirm the fee and send it on WhatsApp.</p>
              <JoinForm code={code} batches={batches} />
            </div>
          </div>
        );
      }}
    </Guard>
  );
}
