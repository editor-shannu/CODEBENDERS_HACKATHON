"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { updateFamily } from "@/app/actions";

export function FamilyEditButton({ f }: { f: { id: string; parentName: string; language: string; notes: string } }) {
  const [open, setOpen] = useState(false);
  const [parentName, setParentName] = useState(f.parentName);
  const [language, setLanguage] = useState(f.language);
  const [notes, setNotes] = useState(f.notes);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>Edit family</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit family">
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="pn">Parent name</label>
            <input id="pn" className={inputClass} value={parentName} onChange={(e) => setParentName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lg">Message language</label>
            <select id="lg" className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="te">Telugu</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="nt">Notes</label>
            <textarea id="nt" rows={3} className={`${inputClass} py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="font-mono text-sm text-khata">{error}</p>}
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => start(async () => { const r = await updateFamily({ id: f.id, parentName, language, notes }); if (!r.ok) return setError(r.error); setOpen(false); })}
          >
            Save
          </Button>
        </div>
      </Sheet>
    </>
  );
}
