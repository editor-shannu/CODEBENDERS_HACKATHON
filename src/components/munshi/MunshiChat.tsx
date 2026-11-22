"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Send, X } from "lucide-react";
import { askMunshiAction } from "@/app/actions";

type Rec = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
type ChatLink = { label: string; url: string; kind: "whatsapp" | "page" };
type Line = { who: "you" | "munshi"; text: string; links?: ChatLink[]; actions?: { title: string; status: string }[]; source?: string };

const CHIPS = ["Who hasn't paid?", "Remind all late families", "Ravi paid 1500 cash", "Add Sita class 8 ₹1500, mother Kavitha", "What if the biggest family pays 15 days late?", "Will I make rent?"];
const LANGS = [
  { id: "en-IN", label: "EN" },
  { id: "te-IN", label: "తె" },
  { id: "hi-IN", label: "हि" },
];

/**
 * Munshi as one chat box on every tutor screen. Type or speak an instruction ("Ravi paid 1500 cash",
 * "add Sita class 8 1200", "remind all late") and Munshi does it; reminders come back as one-tap WhatsApp links.
 */
export function MunshiChat() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, start] = useTransition();
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState("en-IN");
  const rec = useRef<Rec | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, pending]);

  const send = (q: string) => {
    const question = q.trim();
    if (!question || pending) return;
    setOpen(true);
    setText("");
    setLines((l) => [...l, { who: "you", text: question }]);
    start(async () => {
      try {
        const r = await askMunshiAction(question, { direct: true });
        if (!r.ok) {
          setLines((l) => [...l, { who: "munshi", text: r.error }]);
          return;
        }
        setLines((l) => [...l, { who: "munshi", text: r.answer, links: r.links, actions: r.actions, source: r.source }]);
        if (r.actions?.some((a) => a.status === "done")) router.refresh();
      } catch {
        setLines((l) => [...l, { who: "munshi", text: "Something went wrong. Try again in a moment." }]);
      }
    });
  };

  const mic = () => {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setOpen(true);
      setLines((l) => [...l, { who: "munshi", text: "Voice isn't supported in this browser. Chrome on Android works best. You can type instead." }]);
      return;
    }
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript ?? ""; if (t) send(t); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="no-print fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-3 pb-2">
      <div className="mx-auto w-full max-w-3xl">
        {open && (
          <div className="mb-2 max-h-[60dvh] overflow-y-auto border border-dusk-deep/30 bg-plaster p-3 text-dusk-deep shadow-none" role="log" aria-live="polite">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-xl">Munshi</p>
              <button type="button" aria-label="Close chat" onClick={() => setOpen(false)} className="min-h-9 min-w-9"><X className="mx-auto size-5" /></button>
            </div>
            {!lines.length && (
              <div>
                <p className="text-sm text-dusk-deep/70">Tell me what happened or what you need. English, Telugu or Hindi.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHIPS.map((c) => (
                    <button key={c} type="button" onClick={() => send(c)} className="border border-dusk-deep/30 px-2 py-1 text-left text-xs hover:border-brick">{c}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-3">
              {lines.map((l, i) => (
                <div key={i} className={l.who === "you" ? "text-right" : ""}>
                  <p className={`inline-block max-w-[90%] whitespace-pre-wrap px-3 py-2 text-left text-sm ${l.who === "you" ? "bg-dusk-deep text-plaster" : "border-l-4 border-brick bg-white/60"}`}>{l.text}</p>
                  {!!l.actions?.length && (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-dusk-deep/60">{l.actions.map((a) => `${a.title}: ${a.status}`).join(" · ")}</p>
                  )}
                  {!!l.links?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {l.links.map((k) =>
                        k.kind === "whatsapp" ? (
                          <a key={k.url} href={k.url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center border border-[#1f7a4d] bg-[#1f7a4d] px-3 font-mono text-[11px] uppercase tracking-wider text-white">
                            {k.label}
                          </a>
                        ) : (
                          <Link key={k.url} href={k.url} className="inline-flex min-h-9 items-center border border-dusk-deep px-3 font-mono text-[11px] uppercase tracking-wider">
                            {k.label}
                          </Link>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
              {pending && <p className="font-mono text-xs text-dusk-deep/60">Munshi is working…</p>}
              <div ref={end} />
            </div>
          </div>
        )}
        <form
          className="flex items-center gap-2 border-2 border-dusk-deep bg-plaster p-1 text-dusk-deep"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <button type="button" onClick={() => setLang(LANGS[(LANGS.findIndex((x) => x.id === lang) + 1) % LANGS.length].id)} className="min-h-10 min-w-10 font-mono text-xs" aria-label="Voice language">
            {LANGS.find((x) => x.id === lang)?.label}
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={listening ? "Listening…" : "Tell Munshi: \"Ravi paid 1500 cash\""}
            aria-label="Message Munshi"
            className="min-h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
          />
          <button type="button" onClick={mic} aria-label={listening ? "Stop listening" : "Speak to Munshi"} className={`min-h-10 min-w-10 ${listening ? "bg-brick text-plaster" : ""}`}>
            <Mic className="mx-auto size-5" />
          </button>
          <button type="submit" disabled={pending || !text.trim()} aria-label="Send" className="min-h-10 min-w-10 bg-dusk-deep text-plaster disabled:opacity-40">
            <Send className="mx-auto size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
