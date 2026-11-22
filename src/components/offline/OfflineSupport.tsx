"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordFamilyPayment, recordPayment, voiceKhataAction } from "@/app/actions";
import { listQueue, QUEUE_EVENT, removeItem, type QueueItem } from "@/lib/offline-queue";

const PAGES = ["/home", "/owes", "/students", "/invoices", "/forecast", "/munshi"];
const STAMP = "baaki:lastOnline";
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function syncOne(item: QueueItem): Promise<boolean> {
  if (item.kind === "invoicePayment") return (await recordPayment(item.input)).ok;
  const k = await voiceKhataAction(item.text);
  if (!k.ok || !k.note.amount) return false;
  return (await recordFamilyPayment({ familyId: k.familyId, amount: k.note.amount, mode: k.note.mode ?? "CASH", date: item.at.slice(0, 10), reference: "offline" })).ok;
}

/** Registers the service worker, shows the offline banner and the pending-sync queue, and syncs when back online. */
export function OfflineSupport() {
  const [offline, setOffline] = useState(false);
  const [since, setSince] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const syncing = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const refreshQueue = () => listQueue().then(setQueue).catch(() => {});
    const sync = async () => {
      if (syncing.current || !navigator.onLine) return;
      syncing.current = true;
      let done = 0;
      try {
        for (const item of await listQueue()) {
          try {
            if (await syncOne(item)) { await removeItem(item.id!); done++; }
          } catch { break; }
        }
      } finally {
        syncing.current = false;
      }
      if (done) {
        setNote(`Synced ${done} offline change${done > 1 ? "s" : ""}.`);
        router.refresh();
      }
      refreshQueue();
    };
    const update = () => {
      const off = !navigator.onLine;
      setOffline(off);
      if (!off) localStorage.setItem(STAMP, new Date().toISOString());
      setSince(localStorage.getItem(STAMP));
      if (!off) sync();
    };
    update();
    refreshQueue();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(QUEUE_EVENT, refreshQueue);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(async () => {
        const reg = await navigator.serviceWorker.ready;
        if (!navigator.onLine) return;
        const assets = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.startsWith(location.origin));
        reg.active?.postMessage({ type: "warm", urls: [...PAGES, ...assets] });
      }).catch(() => {});
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(QUEUE_EVENT, refreshQueue);
    };
  }, [router]);

  if (!offline && !queue.length && !note) return null;
  return (
    <div className="no-print border-b-2 border-lamp bg-dusk-deep px-4 py-2 font-mono text-xs text-plaster" role="status">
      <div className="mx-auto w-full max-w-5xl">
        {offline && <p>Offline: showing data from {since ? fmt(since) : "your last visit"}. Changes will sync.</p>}
        {queue.length > 0 && (
          <p className="mt-1 text-lamp">Pending sync · {queue.map((q) => q.label).join(" · ")}</p>
        )}
        {!offline && note && !queue.length && (
          <p className="flex items-center justify-between gap-3">{note}<button type="button" className="underline" onClick={() => setNote(null)}>OK</button></p>
        )}
      </div>
    </div>
  );
}
