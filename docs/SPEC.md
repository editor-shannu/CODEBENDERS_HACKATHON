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
- `/` Home: bento grid of live tiles
- `/owes` Who-owes board
- `/students` Student list
- `/students/new` Add student
- `/students/[id]/edit` Edit or deactivate student
- `/families/[id]` Family view
- `/invoices` Invoice list and filters
- `/settings` Tutor name, centre name, UPI ID, UPI display name

## Navigation
Bottom tab bar with lucide-react icons and text labels: Home, Owes, Students,
Invoices, Settings. Icons are used only in the tab bar.

## Visual rules
- Colours: ink #0E0E0E, ledger #F3EAD7, khata red #B3262D, turmeric #E2A529, mint #3FB68B
- Headings in Fraunces, numbers and rupee amounts in IBM Plex Mono
- Ruled-paper lines are the only allowed gradient-like pattern
- No emoji, illustrations, gradients (other than ruled lines), glassmorphism, blur, or shadows

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