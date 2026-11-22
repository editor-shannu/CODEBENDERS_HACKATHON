# Baaki

**The back office for home tutors.** Who owes, what's coming, and a clerk that chases for you.

Baaki (Telugu/Hindi for "what's still due") replaces the fee notebook and the awkward WhatsApp follow-up for India's solo home tutors. The demo runs for **Lakshmi Teaching Point**, a home tuition centre in Vizianagaram, Andhra Pradesh, run by Lakshmi Devi, who teaches maths and science to classes 6 to 10.

Live demo: https://codebendershackathon.vercel.app

## The problem

Millions of home tutors in India collect fees in cash and UPI, track them in a notebook, and chase parents one WhatsApp message at a time. They don't know who's late until rent is due, and every reminder risks souring a relationship with a family they see every evening.

## What Baaki does

- **Who-owes board**: every family's balance, how many days late, and promises made, computed live from today's date in IST.
- **Chase Queue**: swipe right to remind, left to snooze. Families are ranked by a chase score built from amount, lateness, broken promises and reminder history.
- **Tone Dial reminders**: Gentle, Firm or Final WhatsApp messages in **Telugu, Hindi or English**, matched to each family's language, with a UPI pay link inside.
- **Cash-flow forecast**: a cone chart of likely collections against upcoming bills such as rent, with festival and exam seasons slowing collections.
- **Munshi**: a clerk with a daily brief, a Rent Defense Plan, an approval inbox, a Reply Reader that turns "sir next week pakka istanu" into a dated promise, and Ask Munshi (an AI agent loop with tool calls and a visible trace). With no `LLM_API_KEY` it runs on offline rules, so the demo never breaks.
- **Forecast**: a 500-run Monte Carlo cash cone, rent risk, runway, money weather, and Time Machine sliders (late payers, dropouts, fee raise, new admissions).
- **Invoices**: monthly generation with sibling discount, UPI QR, Download PDF (print), and a public Parent Pay Link with an "I've paid" button the tutor confirms in one tap.
- **Students, families, settings**: add or edit students, siblings, bills, festival and exam dates, the Munshi autonomy dial, and a one-tap demo reset.
- **Privacy**: Baaki stores no parent phone numbers. Reminders open WhatsApp with the message ready, and the tutor picks the chat.
- **Sibling discount**: 10% off the second and later child, applied automatically to invoices.

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
npm run db:seed             # optional: demo data (also seeds itself on first visit)
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
3. Deploy. The build creates the tables and the app seeds the demo centre on its first visit.

If `DATABASE_URL` is missing or wrong, the app shows a setup screen explaining what to fix instead of crashing.

### Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `LLM_API_KEY` | No | For the Munshi AI agent (any OpenAI-compatible endpoint) |
| `LLM_BASE_URL` | No | Defaults to Gemini's OpenAI-compatible endpoint |
| `LLM_MODEL` | No | Defaults to `gemini-2.5-flash` |

## Project structure

```
prisma/          schema and seed script
src/app/         pages (/, /owes) and server actions
src/components/  UI primitives, Chase Queue, forecast, reminders
src/lib/         IST date engine, invoice status, forecast, messages, UPI links, Munshi rules
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

## Design decisions

- **Every date is IST and computed live.** Overdue status and days late are never stored, so the demo is always correct on the day it is shown.
- **Money is whole rupees** (integers), avoiding floating-point errors.
- **Enums are Zod-validated strings**, keeping the schema portable.

## Roadmap

WhatsApp Business API sending · tests for the forecast and date engine · multi-tutor accounts.

## Team

Built for the Codebenders Hackathon.
