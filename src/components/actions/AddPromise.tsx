"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, inputClass, labelClass } from "@/components/ui/Button";
import { addPromise } from "@/app/actions";

export function AddPromiseButton({ familyId, amount, today, parent }: { familyId: string; amount: number; today: string; parent: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [amt, setAmt] = useState(String(amount));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>Add promise</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`${parent} promised to pay`}>
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="pd">On</label>
            <input id="pd" type="date" min={today} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pa">Amount (₹)</label>
            <input id="pa" inputMode="numeric" className={inputClass} value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pn">What they said</label>
            <input id="pn" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after salary on Friday" />
          </div>
          {error && <p className="font-mono text-sm text-khata">{error}</p>}
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await addPromise({ familyId, promisedDate: date, amount: Number(amt), note });
                if (!r.ok) return setError(r.error);
                setOpen(false);
              })
            }
          >
            Save promise
          </Button>
        </div>
      </Sheet>
    </>
  );
}
