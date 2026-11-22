# Baaki

**The back office for home tutors.** Who owes, what is coming, and a clerk that chases payments for you.

Baaki is a Next.js web application for tutors and tuition centres to track rent and fee collection. It shows what each family owes, what has been paid, generates invoices with payment links, and forecasts upcoming cash flow. It replaces the fee notebook and the manual WhatsApp follow-up that many solo tutors rely on.

Live demo: https://codebendershackathon.vercel.app

## Problem

Many home tutors in India collect fees in cash and UPI, record them in a notebook, and follow up with parents one WhatsApp message at a time. There is no simple view of who owes what, and chasing late payments is slow and awkward.

## Key features

- **Who-owes board** (`/owes`): each family's balance, days late, and promises to pay, computed live from today's date in IST.
- **Chase queue**: families ranked by a chase score based on amount owed, lateness, and broken promises.
- **Tone-based reminders**: Gentle, Firm, or Final WhatsApp messages in Telugu, Hindi, or English, with a UPI payment link. Reminders open WhatsApp with the message prepared; the tutor chooses the chat.
- **Munshi assistant** (`/munshi`): a daily brief, a Rent Defense Plan, an approval inbox, and a reply reader that converts informal promises into dated commitments. Requires an LLM API key.
- **Forecast** (`/forecast`): a Monte Carlo cash-flow cone (500 runs), rent risk, runway, and what-if sliders for late payers, dropouts, fee changes, and new admissions. Festival and exam seasons are factored in.
- **Invoices** (`/invoices`): monthly generation, UPI QR codes, printable PDF download, and a public parent payment page (`/pay/[token]`) with an "I've paid" button.
- **Students and families**: add and edit students, siblings, bills, festival and exam dates, and settings, including a demo reset.
- **Sibling discount**: 10% off the second and later child, applied automatically to invoices.
- **Privacy**: parent phone numbers are not stored.

## Tech stack

| Area | Technology |
| --- | --- |
| Language | TypeScript 5 |
| Framework | Next.js 16 (App Router, Server Actions), React 19 |
| Database | PostgreSQL with Prisma 6 |
| Styling | Tailwind CSS 4 |
| Landing scene | React Three Fiber / three.js |
| Charts | Recharts |
| Validation | Zod |
| Testing | Vitest |

## Getting started

### Prerequisites

- Node.js 20 or later
- A PostgreSQL database: local, [Neon](https://neon.tech), or [Supabase](https://supabase.com)

### 1. Clone and install

```bash
git clone https://github.com/editor-shannu/CODEBENDERS_HACKATHON.git
cd CODEBENDERS_HACKATHON
npm install
```

`npm install` runs `prisma generate` automatically through the `postinstall` script.

### 2. Configure the environment

Copy the example file and set your database connection string.

Windows (Command Prompt or PowerShell):

```powershell
copy .env.example .env
```

or, in PowerShell:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and set `DATABASE_URL`. See [Environment variables](#environment-variables) for all options.

### 3. Create the database tables

```bash
npm run db:push
```

Optionally, load demo data:

```bash
npm run db:seed
```

### 4. Start the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Generate the Prisma client, push the schema if `DATABASE_URL` is set, then build Next.js (via `scripts/build.mjs`) |
| `npm start` | Start the production server (run after `npm run build`) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:seed` | Reset and seed the demo centre, dated from today |

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LLM_API_KEY` | For Munshi AI | API key for the Munshi assistant. Empty by default |
| `LLM_BASE_URL` | No | OpenAI-compatible endpoint. Defaults to `https://generativelanguage.googleapis.com/v1beta/openai` (Google Gemini) |
| `LLM_MODEL` | No | Model name. Defaults to `gemini-2.5-flash` |

Do not commit `.env` to version control.

## Project structure

```text
src/
  app/                  Routes (pages) and server actions in actions.ts
  components/          Components grouped by feature, plus ui/ and landing/
  lib/                  Shared logic:
    data.ts               data access
    db.ts                 Prisma client
    forecast.ts           cash-flow forecast
    money.ts              money handling (whole rupees)
    dates.ts              IST date engine
    upi.ts                UPI payment links
    validators.ts         Zod validation
    board-view.ts         who-owes board view
    messages.ts           reminder messages
    munshi/
      agent.ts            Munshi assistant logic
      rules.ts            Munshi rules
prisma/
  schema.prisma         database schema
  seed.ts               demo data seed script
docs/
  SPEC.md               product specification and build order
scripts/
  build.mjs             build script (Prisma generate, db push, Next.js build)
public/                 Static assets, including 3D textures in public/3d
```

### Application routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/home` | Tutor dashboard |
| `/owes` | Who-owes board and chase queue |
| `/forecast` | Cash-flow forecast |
| `/munshi` | Munshi AI assistant |
| `/parent` | Parent view |
| `/students` | Student list |
| `/students/new` | Add a student |
| `/students/[id]/edit` | Edit a student |
| `/families/[id]` | Family detail |
| `/invoices` | Invoice list |
| `/invoices/[id]` | Invoice detail |
| `/pay/[token]` | Public parent payment page |
| `/settings` | Settings |

## Deployment

Baaki is designed to deploy on [Vercel](https://vercel.com) with a Neon or Supabase PostgreSQL database.

1. Import the repository into Vercel.
2. Add a PostgreSQL database (through Vercel Storage with Neon, or any Neon or Supabase connection URL) and set `DATABASE_URL` in Project → Settings → Environment Variables. Set `LLM_API_KEY` as well if you want the Munshi features.
3. Deploy. The build script pushes the schema to the database when `DATABASE_URL` is set, and the app seeds the demo centre on its first visit.

## Design decisions

- **Every date is IST and computed live.** Overdue status and days late are never stored, so the demo is always correct on the day it is shown.
- **Money is stored as whole rupees** (integers), which avoids floating-point errors.
- **Enums are Zod-validated strings**, which keeps the schema portable.

## Asset credits

Landing scene assets are from [Poly Haven](https://polyhaven.com), licensed CC0, and stored in `public/3d`:

- HDRI sky: [Kloppenheim 06 (Pure Sky)](https://polyhaven.com/a/kloppenheim_06_puresky) by Greg Zaal, sky edits by Jarod Guest
- Texture: [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall) by Amal Kumar
- Texture: [Clay Roof Tiles 02](https://polyhaven.com/a/clay_roof_tiles_02) by Amal Kumar
- Texture: [Dirt](https://polyhaven.com/a/dirt) by Charlotte Baglioni

## Roadmap

WhatsApp Business API sending · tests for the forecast and date engine · multi-tutor accounts.

## Team

Built for the Codebenders Hackathon.

## License

Not yet specified.

