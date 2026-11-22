"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, inputClass } from "@/components/ui/Button";

/** Accepts a full pay link (https://…/pay/abc) or the bare token, and opens the pay page. */
export function PayLinkForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    const m = raw.match(/\/pay\/([A-Za-z0-9_-]+)/);
    const token = m ? m[1] : /^[A-Za-z0-9_-]{6,}$/.test(raw) ? raw : null;
    if (!token) return setError("That doesn't look like a Baaki pay link.");
    router.push(`/pay/${token}`);
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="paylink" className="block font-mono text-[11px] uppercase tracking-[0.12em] text-plaster/70">
        Paste the pay link from your WhatsApp message
      </label>
      <input id="paylink" value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} placeholder="https://…/pay/…" className={inputClass} />
      {error && <p className="font-mono text-xs text-brick">{error}</p>}
      <Button type="submit" className="w-full">Open my fee</Button>
    </form>
  );
}
