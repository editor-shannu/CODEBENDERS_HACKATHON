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
- **Munshi brief**: a rules-based clerk that suggests the day's actions (who to chase, early-pay discounts, bills to defer), designed to grow into an LLM agent.
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

## Design decisions

- **Every date is IST and computed live.** Overdue status and days late are never stored, so the demo is always correct on the day it is shown.
- **Money is whole rupees** (integers), avoiding floating-point errors.
- **Enums are Zod-validated strings**, keeping the schema portable.

## Roadmap

Students, families, invoices and settings pages · UPI QR codes · parent pay link · invoice PDF and PWA · Munshi as a full LLM agent with ask-before-acting autonomy.

## Team

Built for the Codebenders Hackathon.
