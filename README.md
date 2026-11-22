# Baaki

**The back office for home tutors.** Who owes, what's coming, and a clerk that chases for you.

Baaki (Telugu/Hindi for "what's still due") replaces the fee notebook and the awkward WhatsApp follow-up for India's solo home tutors.

Live: https://codebendershackathon.vercel.app · **Try the demo** (no sign-in): https://codebendershackathon.vercel.app/api/demo

The demo opens a throwaway account for **Lakshmi Teaching Point**, a synthetic home tuition centre in Vizianagaram run by Lakshmi Devi, with 19 families of made-up data. Every demo account is isolated and deleted after 12 hours. Real accounts sign in with Google and start empty: no sample data is ever added to them.

## The problem

Millions of home tutors in India collect fees in cash and UPI, track them in a notebook, and chase parents one WhatsApp message at a time. They don't know who's late until rent is due, and every reminder risks souring a relationship with a family they see every evening.

## What Baaki does

### No typing: get data in the way tutors already work

- **Tell Munshi**: one chat box on every screen. Type or speak in English, Telugu or Hindi: "Ravi paid 1500 cash", "add Sita class 8 ₹1500, mother Kavitha", "who hasn't paid?", "remind all late". Munshi does it, and reminders come back as one-tap WhatsApp buttons.
- **Import the parents' WhatsApp group**: export the chat (Without media) and share or upload it. Baaki finds each parent, child and class, and every "paid" or "will pay Friday" message, and you tick what to keep.
- **Parents add themselves**: share one join link or QR in the group. Parents fill in their child's name and class; you tap Approve.
- **Someone paid?** Share a GPay or PhonePe screenshot, or paste a bank SMS, straight from the phone's share sheet (Baaki installs as an app). Munshi reads the amount and name and matches the family.

### The back office

- **Who-owes board**: every family's balance, how many days late, and promises made, computed live from today's date in IST.
- **Chase Queue**: swipe right to remind, left to snooze. Families are ranked by a chase score built from amount, lateness, broken promises and reminder history.
- **Tone Dial reminders**: Gentle, Firm or Final WhatsApp messages in **Telugu, Hindi or English**, matched to each family's language, with a UPI pay link inside.
- **Cash-flow forecast**: a cone chart of likely collections against upcoming bills such as rent, with festival and exam seasons slowing collections.
- **Munshi**: a clerk with a daily brief, a Rent Defense Plan, an approval inbox, a Reply Reader that turns "sir next week pakka istanu" into a dated promise, and Ask Munshi (an AI agent loop with tool calls and a visible trace). With no `LLM_API_KEY` it runs on offline rules, so the demo never breaks.
- **Forecast**: a 500-run Monte Carlo cash cone, rent risk, runway, money weather, and Time Machine sliders (late payers, dropouts, fee raise, new admissions).
- **Invoices**: monthly generation with sibling discount, UPI QR, Download PDF (print), and a public Parent Pay Link with an "I've paid" button the tutor confirms in one tap.
- **Students, families, settings**: add or edit students, siblings, bills, festival and exam dates, and the Munshi autonomy dial.
- **Privacy**: Baaki stores no parent phone numbers. Reminders open WhatsApp with the message ready, and the tutor picks the chat.
- **Sibling discount**: 10% off the second and later child, applied automatically to invoices.

## Who pays

The tutor, never the parent. Free for up to 10 students; **Baaki Pro ₹99 a month** (₹999 a year) for unlimited students, Munshi chat, WhatsApp import and the forecast; **Centre ₹299 a month** for 2 to 5 teachers. A tutor with 25 students at ₹2,000 has ₹50,000 a month in a notebook: one late family paying on time covers Pro for a year. Every pay link and join link a parent opens shows Baaki to the next tutor in the colony. See `/pricing` in the app. (Launch pricing; payments are not switched on in the hackathon build.)

## Tech stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Prisma + PostgreSQL · Tailwind CSS 4 · Zod · Recharts · Vitest

Design system "Ledger Noir": ink, ledger cream, khata red, turmeric and mint; Fraunces headings and IBM Plex Mono numbers on ruled paper.

## Run it locally

Requirements: Node 20+ and a Postgres database (local, Neon or Supabase).

```bash
git clone https://github.com/editor-shannu/CODEBENDERS_HACKATHON.git
cd CODEBENDERS_HACKATHON
npm install
cp .env.example .env        # set DATABASE_URL
npm run db:push             # create tables
npm run db:seed             # optional: synthetic demo data for local testing
npm run dev                 # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Generates the Prisma client, syncs the schema if `DATABASE_URL` is set, builds Next.js |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:seed` | Reset and seed the demo centre, dated from today |
| `npm run lint` / `npm test` | ESLint / Vitest |

## Deploy on Vercel

1. Import the repo in Vercel.
2. Add a Postgres database (Vercel → Storage → Neon, or any Neon/Supabase URL) and set `DATABASE_URL` in Project → Settings → Environment Variables. Use the pooled connection string with `?sslmode=require`.
3. Deploy. The build creates the tables. Real accounts start empty; `/api/demo` creates an isolated synthetic demo account.

If `DATABASE_URL` is missing or wrong, the app shows a setup screen explaining what to fix instead of crashing.

### Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `LLM_API_KEY` | No | For the Munshi AI agent (any OpenAI-compatible endpoint) |
| `LLM_BASE_URL` | No | Defaults to Groq (`https://api.groq.com/openai/v1`) |
| `LLM_MODEL` | No | Defaults to `openai/gpt-oss-120b` |

## Project structure

```
prisma/          schema and seed script
src/app/         pages (/, /owes) and server actions
src/components/  UI primitives, Chase Queue, forecast, reminders
src/lib/         IST date engine, invoice status, forecast, messages, UPI links
src/lib/munshi/  agent (tools + LLM loop), rules fallback, execute (approval + autonomy), guardrails, memory, plan
docs/SPEC.md     product spec and build order
```

## Landing

`/` is a landing page that tells one month of a tuition centre in one scroll. It is a
tilt-shift miniature of a Hyderabad colony lane at dusk: plastered houses with balconies and
iron grills, tulsi pots, a neem tree, an Irani chai stall with steam, autos and a scooter,
tangled wires, a clothes line, and Lakshmi Teaching Point on the first floor with a
hand-painted signboard. Charminar sits hazy on the far skyline. Each house is one family, and
its window shows the fee status: lit means paid.

Chapters (flat HTML text over the canvas, pinned with GSAP ScrollTrigger, smoothed with Lenis):

1. **Day 1**: the camera glides down from above the city. "Every rupee you're owed, on one street." Every window is dark.
2. **Day 5**: invoice slips flutter from the centre's window to each doorstep.
3. **Day 10**: windows light up as families pay, with a collected vs owed counter. "Lit means paid."
4. **Day 15**: promised houses flicker dimly, with a Munshi note about the promise.
5. **Day 20**: clouds roll in if the forecast says rent is at risk; the rent clock on the centre's wall counts down.
6. **Day 25**: a chalk line on the road joins the three houses of the Rent Defense Plan, which light in turn.
7. **Rent day**: night, every window lit, Charminar lit. "Rent's safe. Go teach."
8. **Selection**: the camera settles on the teaching point's window. "I run the centre" dives into it and opens `/home`; "I'm a parent" opens `/parent` (pick a family or paste a pay link).

Names and amounts come from the live database (`loadDashboard`, up to 12 houses); if the
database is empty or unreachable, a built-in demo street is shown. "Skip to dashboard" is in the
corner from the first frame.

Performance and fallbacks: the canvas is a client component loaded with `next/dynamic`
(`ssr: false`) over a flat SVG poster, so the page paints before WebGL loads. DPR is capped at
1.5; drei's `PerformanceMonitor` drops tilt-shift and shadows when frames fall, and switches to
the poster if they keep falling. The render loop pauses when the page is hidden. With
`prefers-reduced-motion`, no WebGL, or low FPS, the poster changes per chapter with the same text,
and scrolling and the selection still work.

All geometry is procedural (three.js boxes, cylinders, cones and tubes); no 3D models are used.

### Asset credits

All from [Poly Haven](https://polyhaven.com), licensed CC0, stored in `public/3d` (1K source,
textures re-encoded to WebP):

- HDRI sky: [Kloppenheim 06 (Pure Sky)](https://polyhaven.com/a/kloppenheim_06_puresky) by Greg Zaal, sky edits by Jarod Guest
- Texture: [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall) by Amal Kumar
- Texture: [Clay Roof Tiles 02](https://polyhaven.com/a/clay_roof_tiles_02) by Amal Kumar
- Texture: [Dirt](https://polyhaven.com/a/dirt) by Charlotte Baglioni

## Prompts and iterations

### Setup in four steps

1. **Database**: create a free Postgres on [Neon](https://neon.tech) and copy the pooled connection string (ends in `?sslmode=require`) into `DATABASE_URL` in `.env` (locally) or in Vercel's Environment Variables.
2. **AI (optional)**: set `LLM_API_KEY` for any OpenAI-compatible endpoint. Groq is the default (`LLM_BASE_URL` = `https://api.groq.com/openai/v1`, `LLM_MODEL` = `openai/gpt-oss-120b`). Without a key every Munshi feature runs on offline rules.
3. **Migrate and seed**: `npm run db:push` creates the tables, `npm run db:seed` loads the synthetic Lakshmi Teaching Point dated from today, for local testing only.
4. **Run**: `npm run dev`. Tutors sign in with Google (Firebase). `/api/demo` opens a synthetic demo account with no sign-in. Parents open their own pay link or join link and never sign in.

### Munshi's system prompt

Built in `munshiSystemPrompt()` in `src/lib/munshi/agent.ts`:

> You are Munshi, the back-office clerk for {centre}, a home tuition centre in India. Today is {date} (IST). Use the tools to look up real numbers before answering. Every amount and date you state must come from a tool result in this conversation; never invent or estimate one. Answer in 1 to 3 short sentences, amounts in rupees with Indian grouping (₹14,500). Be practical and kind about parents. Never threaten, shame, or pressure a family, and never suggest stopping a child's classes as a punishment. Never share one family's fees, promises or notes in a message meant for another family. Reminders are drafts in the family's own language (te, hi or en); you never send them. The tutor sends from WhatsApp. The autonomy dial is {mode}. Write tools may land in the approval inbox; say so when they do. Money actions (payments, invoices, due dates) always wait for the tutor.
>
> In the chat box the last sentence is replaced with: the tutor is typing to you; treat clear instructions as done ("Ravi paid 1500 cash" means log_payment, "add Sita class 8 1200" means add_student, "remind all late" means remind_all_late); ask one short question only when a required detail is missing. A payment from chat is recorded only when the tutor's own words say the family paid.

The Reply Reader uses a second, JSON-only prompt: read a parent's WhatsApp reply (English, Telugu, Hindi, Tenglish or Hinglish), only report a date or amount the parent actually said, and return `{promisedDate, amount, confidence, summary}`.

### Tools

| Tool | Kind | What it does |
| --- | --- | --- |
| `list_owing_families` | read | Families who owe, ranked by chase score |
| `get_totals` | read | Total pending and counts (answer shows an owed-by-family bar chart) |
| `get_rent_risk` | read | Chance of being short on rent day, runway, from the 500-run forecast |
| `get_family` | read | One family's balance, lateness, promises and learned memory |
| `run_what_if` | read | Re-runs the forecast with extra delay, dropouts, a fee raise or new admissions (answer shows a before vs after cash line) |
| `draft_reminder` | write (low risk) | WhatsApp draft in the family's language with the real amount; never sends |
| `schedule_nudge` | write (low risk) | Schedules a reminder nudge for a date |
| `record_promise` | write (low risk) | Saves a family's promise to pay |
| `flag_risk` | write (low risk) | Flags a family as a collection risk |
| `log_payment` | write (money) | Proposes recording a payment; always needs approval |
| `propose_due_date_change` | write (money) | Proposes a new monthly due day; always needs approval |
| `create_invoice` | write (money) | Proposes a DRAFT invoice; always needs approval |

Every write goes through `proposeOrRun()` in `src/lib/munshi/execute.ts`. With the autonomy dial on **Ask** (default) or **Suggest**, it lands in the approval inbox and runs when the tutor taps Approve. On **Auto**, low-risk writes (gentle drafts, nudges, promises, flags) run at once and are logged; money writes still wait. Without `LLM_API_KEY`, the offline rules map the question to the same tools by keywords ("what if everyone pays 10 days late", "draft a firm message for Suresh", "Padma promised Friday", "Anitha paid 1000 by UPI").

### Guardrails

- The system prompt above forbids threats, shaming, invented numbers and cross-family details.
- Code check: any rupee amount in a drafted reminder must match a database value for that family (balance, an unpaid invoice, monthly fee, open promise), else it is dropped (`checkAmounts` in `src/lib/munshi/guardrails.ts`). AI answers keep only amounts that appeared in tool results, and an answer with threatening words is replaced by the offline answer.
- WhatsApp links are always `https://wa.me/?text=...` with no phone number. Baaki stores no parent phone numbers.
- A pay page reads one invoice by its token and only that family's name and active children; draft invoices have no working pay link.

### Key build prompts, per feature

- **Chase Queue mark paid**: "A Mark paid button on the top card opens the existing RecordPayment sheet prefilled with the due amount; on success show the PAID stamp and advance the queue."
- **Approve all**: "One server action that approves every pending brief action, logs each to AgentAction, returns a count."
- **Rent Defense progress**: "Persist the plan as AgentPlan with steps, each with a family and amount. When a payment or confirmed claim lands, mark matching steps done and update covered vs rent gap."
- **Munshi tools**: "From 4 to 12 tools; write tools create a pending AgentAction unless autonomy allows; mirror each in the rules fallback with keyword matching."
- **Ask Munshi charts**: "When an answer used run_what_if or get_totals, return structured data and render a small recharts chart. Keep the tool trace."
- **Autonomy dial**: "Ask sends everything to the approval inbox. Auto runs low-risk actions immediately; money actions always need approval."
- **Guardrails**: "No threats or shaming, no invented amounts or dates, no cross-family data; any amount in a drafted message must match a DB value."
- **Family memory**: "Update memory after payments, promises and Reply Reader results; feed it into Payday Sync and reminder timing; expose getHouseStatus(familyId)."
- **Reply Reader follow-ups**: "If a reply has a promise, create the PayPromise and a follow-up reminder for the day after, refresh the forecast, show what was scheduled."
- **Draft invoices**: "Monthly generation creates DRAFT invoices; Drafts filter and Issue all; pay links only work for issued invoices."

### What changed between iterations

1. **v1, the notebook**: who-owes board, students and families with sibling billing, invoices and payments, all dates computed live in IST.
2. **v2, the clerk**: Munshi as offline rules (Morning Brief with a Why for each item, Reply Reader, Payday Sync), then an LLM agent loop with four read tools and a visible trace, falling back to rules when the key is missing or the call fails.
3. **v3, the forecast**: 500-run seeded Monte Carlo cash cone, rent risk, money weather, runway and Time Machine sliders; the Rent Defense Plan built from it.
4. **v4, parents**: public pay link with UPI QR and an "I've paid" claim the tutor confirms; WhatsApp reminders switched to `wa.me/?text=` with no phone numbers anywhere.
5. **v5, the look**: Old City palette, HouseStatus windows (lit = paid) and the 3D Hyderabad lane landing (built in parallel on `feat/ui-3d`).
6. **v6, Munshi acts** (this round): 12 tools with an approval inbox that actually executes, a working autonomy dial, guardrails in prompt and code, family memory that learns, Reply Reader follow-ups, a tracked Rent Defense Plan, charts in Ask Munshi, Chase Queue mark paid, Approve all and draft invoices.

## Design decisions

- **Every date is IST and computed live.** Overdue status and days late are never stored, so the demo is always correct on the day it is shown.
- **Money is whole rupees** (integers), avoiding floating-point errors.
- **Enums are Zod-validated strings**, keeping the schema portable.

## Roadmap

WhatsApp Business API sending (needs Meta approval) · UPI AutoPay for subscriptions · bank SMS auto-read in an Android app · multi-teacher Centre plan · Telugu-script names in Voice Khata.

## Team

Built for the Codebenders Hackathon.
