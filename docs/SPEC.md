# Baaki: product spec (short)

## What it is
Baaki is a web app for "Lakshmi Teaching Point", a solo home tuition centre run by
Lakshmi Devi in Vizianagaram, Andhra Pradesh. She teaches maths and science to
classes 6 to 10 and tracks fees today in a notebook and WhatsApp. Baaki shows who
owes money, predicts cash flow, and later gets an AI agent called Munshi.

## Defaults
- Tutor: Lakshmi Devi
- Centre: Lakshmi Teaching Point
- Batches: "Class 6-7 Evening", "Class 8 Maths", "Class 9-10 Board Prep"
- Currency: INR, stored as whole rupees
- Time zone: Asia/Kolkata (IST) for every date
- Languages for parent messages: English (en), Telugu (te), Hindi (hi)

## Settings (editable)
Tutor name, centre name, UPI ID, UPI display name.

## Pages
- `/owes` Who-owes board
- `/students` Student list
- `/students/new` Add student
- `/students/[id]/edit` Edit or deactivate student
- `/families/[id]` Family view
- `/invoices` Invoice list and filters
- `/` Landing: one month in one scroll, ends with "I run the centre" (→ `/home`) or "I'm a parent" (→ `/parent`)
- `/home` Dashboard
- `/parent` Parent picker: pick a family or paste a pay link
- `/settings` Tutor name, centre name, UPI ID, UPI display name

## Navigation
Bottom tab bar (hidden on `/`, `/parent` and `/pay/*`) with lucide-react icons and text labels: Home (`/home`), Owes, Students,
Invoices, Settings. Icons are used only in the tab bar.

## Visual rules
- Colours: dusk #141c2b (background), dusk-deep #0c1220, lamp #f2b35a (paid, positive,
  primary action), brick #b4432e (overdue, broken promise, PAID stamp ink), plaster #f3ead8
  (cards, main text on dark), slate-mute #8a97a8 (secondary text)
- Headings in Fraunces, numbers and rupee amounts in IBM Plex Mono
- Ruled-paper lines are the only allowed gradient-like pattern
- Fee status is shown with the HouseStatus icon: lit window = paid, half-lit = promised,
  dark window with a brick door = owes
- App pages: flat, no 3D, no scroll animations, tap targets at least 44px, one main action
  per screen. No emoji, gradients (other than ruled lines), glassmorphism, blur, or shadows.
- The landing page (`/`) is the one exception: its 3D layer may use light, shadow, depth of
  field, bloom, grain and vignette. Its text stays flat HTML over the canvas, and it falls
  back to a flat poster for reduced motion, no WebGL, or low frame rates.

## Dates
- Every date is derived from the current IST date. Nothing is hard-coded.
- Dates display as "Sat, 21 Nov 2026".
- Days late is computed live from today and is never stored.
- Overdue is computed, not stored. An invoice is overdue when its status is not PAID
  and its due date is before today (IST day comparison).

## Data model (summary)
Family, Student, Invoice, Payment, Promise, Bill, AgentAction, Settings (singleton),
KeyDate. Enums are plain strings validated with Zod, so the schema stays
Postgres-ready.

## Build order
1. Scaffold, tokens, layout, navigation
2. Schema, IST date library, invoice status logic, tests
3. Seed data, Key Dates, Bills, Settings
4. UI primitives
5. Students and families
6. Invoices and generation
7. Record payment
8. Who-owes board
9. Home bento grid
10. README and responsive check
11. WhatsApp reminders
12. UPI QR codes
13. Parent pay link
14. Invoice PDF and PWA manifest