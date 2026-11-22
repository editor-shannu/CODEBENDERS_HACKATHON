"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { saveStudent, setStudentActive } from "@/app/actions";
import { BATCHES } from "@/lib/validators";

type Family = { id: string; parentName: string };
type Student = { id: string; name: string; batch: string; monthlyFee: number; dueDay: number; active: boolean; familyId: string };

export function StudentForm({ families, student, defaultFamilyId }: { families: Family[]; student?: Student; defaultFamilyId?: string }) {
  const router = useRouter();
  const [name, setName] = useState(student?.name ?? "");
  const [batch, setBatch] = useState(student?.batch ?? BATCHES[0]);
  const [fee, setFee] = useState(String(student?.monthlyFee ?? 800));
  const [dueDay, setDueDay] = useState(String(student?.dueDay ?? 10));
  const [familyId, setFamilyId] = useState(student?.familyId ?? defaultFamilyId ?? "");
  const [parentName, setParentName] = useState("");
  const [language, setLanguage] = useState("te");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveStudent({ id: student?.id, name, batch, monthlyFee: fee, dueDay, familyId: familyId || undefined, parentName, language });
      if (!r.ok) return setError(r.error);
      router.push(student ? `/families/${student.familyId}` : "/students");
      router.refresh();
    });

  return (
    <div className="ruled-paper max-w-xl space-y-4 border border-dusk-deep/15 p-5 text-dusk-deep">
      <div>
        <label className={labelClass} htmlFor="name">Student name</label>
        <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sai Kiran" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass} htmlFor="batch">Batch</label>
          <select id="batch" className={inputClass} value={batch} onChange={(e) => setBatch(e.target.value as typeof batch)}>
            {BATCHES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="fee">Monthly fee (₹)</label>
          <input id="fee" inputMode="numeric" className={inputClass} value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <label className={labelClass} htmlFor="due">Due day of month</label>
          <input id="due" inputMode="numeric" className={inputClass} value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      {!student && (
        <div className="space-y-3 border-t border-dusk-deep/15 pt-4">
          <div>
            <label className={labelClass} htmlFor="fam">Family</label>
            <select id="fam" className={inputClass} value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
              <option value="">New family</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.parentName} (sibling)</option>)}
            </select>
          </div>
          {!familyId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="parent">Parent name</label>
                <input id="parent" className={inputClass} value={parentName} onChange={(e) => setParentName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lang">Message language</label>
                <select id="lang" className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="te">Telugu</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
            </div>
          )}
          {familyId && <p className="font-mono text-[11px] text-dusk-deep/60">Second and later children get 10% sibling discount.</p>}
        </div>
      )}
      {error && <p className="font-mono text-sm text-brick">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : student ? "Save changes" : "Add student"}</Button>
        {student && (
          <Button
            variant={student.active ? "danger" : "lamp"}
            disabled={pending}
            onClick={() => start(async () => { await setStudentActive(student.id, !student.active); router.refresh(); })}
          >
            {student.active ? "Deactivate" : "Reactivate"}
          </Button>
        )}
      </div>
    </div>
  );
}
