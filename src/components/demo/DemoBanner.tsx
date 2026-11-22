import { resetDemoAction } from "@/app/demo-actions";

/** Shown on every tutor page while a demo account is open: the data is synthetic and can be reset. */
export function DemoBanner() {
  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-brick bg-lamp px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-dusk-deep">
      <span>Demo · Lakshmi Teaching Point · all data synthetic</span>
      <span className="flex items-center gap-3">
        <form action={resetDemoAction}>
          <button type="submit" className="min-h-8 border border-dusk-deep px-2 hover:bg-dusk-deep hover:text-lamp">Reset demo</button>
        </form>
        <a href="https://youtu.be/7ZoK0pLYzmA" target="_blank" rel="noopener noreferrer" className="underline">▶ Demo video</a>
        <a href="/login" className="underline">Use your own centre</a>
      </span>
    </div>
  );
}
