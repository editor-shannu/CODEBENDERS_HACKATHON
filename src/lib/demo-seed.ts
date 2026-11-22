import "server-only";
import { rawDb } from "./prisma";
import { randomBytes } from "node:crypto";
import { addDays, addMonths, dateInMonth, fromKey, monthKey, monthStart, todayIST } from "./dates";
import { familyMonthlyFee } from "./family-stats";

/**
 * Synthetic demo data for "Lakshmi Teaching Point", Vizianagaram.
 * Everything is generated relative to TODAY in IST, so the story stays true whenever it is reset:
 * about ₹14,500 pending, days late from ~6 to ~47, two families with two broken promises each.
 */

type Habit = "ONTIME_CASH" | "SAMEDAY_UPI" | "LATE" | "CHRONIC" | "PARTIAL" | "BREAKER" | "PAYDAY" | "LEFT" | "PROMISE";

type Fam = {
  parent: string;
  phone: string;
  language: "en" | "te" | "hi";
  habit: Habit;
  dueDay: number;
  notes: string;
  memory: Record<string, string>;
  kids: { name: string; batch: string; fee: number; active?: boolean }[];
};

const B6 = "Class 6-7 Evening";
const B8 = "Class 8 Maths";
const B9 = "Class 9-10 Board Prep";

const FAMILIES: Fam[] = [
  { parent: "Ramesh Naidu", phone: "+919849012345", language: "te", habit: "ONTIME_CASH", dueDay: 5, notes: "Pays cash in person, always a day or two early.", memory: { bestTime: "Morning, at drop-off", tone: "Never needed a reminder" },
    kids: [ { name: "Sai Charan Naidu", batch: B9, fee: 3000 }, { name: "Harika Naidu", batch: B6, fee: 1800 } ] },
  { parent: "Srinivasa Rao Kondapalli", phone: "+919866123456", language: "te", habit: "SAMEDAY_UPI", dueDay: 10, notes: "Pays by PhonePe on the due date.", memory: { bestTime: "Evening after 7 pm" },
    kids: [ { name: "Pranav Kondapalli", batch: B8, fee: 2200 } ] },
  { parent: "Venkatesh Pydi", phone: "+919959234567", language: "te", habit: "CHRONIC", dueDay: 5, notes: "Runs a tiffin centre; cash flow is uneven. Usually pays 30 to 45 days late.", memory: { bestTime: "After 9 pm, once the shop closes", tone: "Firm works better than gentle" },
    kids: [ { name: "Ravi Teja Pydi", batch: B9, fee: 3000 } ] },
  { parent: "Lakshmana Rao Gedela", phone: "+919491345678", language: "te", habit: "PARTIAL", dueDay: 10, notes: "Pays in two parts: around the 15th and at month-end.", memory: { bestTime: "Sunday morning", payday: "Splits payments" },
    kids: [ { name: "Bhavya Gedela", batch: B6, fee: 1500 }, { name: "Bharath Gedela", batch: B8, fee: 2200 } ] },
  { parent: "Suresh Babu Allu", phone: "+919703456789", language: "te", habit: "BREAKER", dueDay: 5, notes: "Promised twice last month and missed both dates.", memory: { bestTime: "Lunch hour, 1 to 2 pm", tone: "Gentle reminders get ignored" },
    kids: [ { name: "Keerthi Allu", batch: B9, fee: 2800 } ] },
  { parent: "Padma Rani Bonela", phone: "+919640567890", language: "te", habit: "BREAKER", dueDay: 10, notes: "Mother handles fees. Two missed promises in October.", memory: { bestTime: "Afternoon, 3 to 5 pm" },
    kids: [ { name: "Yashwanth Bonela", batch: B8, fee: 2200 } ] },
  { parent: "Appala Naidu Kandi", phone: "+918897678901", language: "te", habit: "PAYDAY", dueDay: 10, notes: "Father works at the jute mill; salary on the 15th, pays right after.", memory: { bestTime: "Evening", payday: "Around the 17th" },
    kids: [ { name: "Divya Kandi", batch: B9, fee: 3000 } ] },
  { parent: "Raju Mandapati", phone: "+919000789012", language: "en", habit: "SAMEDAY_UPI", dueDay: 5, notes: "Prefers English messages. Pays by GPay.", memory: { bestTime: "Morning" },
    kids: [ { name: "Manoj Mandapati", batch: B6, fee: 1600 } ] },
  { parent: "Sunitha Chintalapudi", phone: "+919182890123", language: "te", habit: "LATE", dueDay: 10, notes: "Pays 10 to 15 days late but always pays.", memory: { bestTime: "After 8 pm" },
    kids: [ { name: "Sneha Chintalapudi", batch: B9, fee: 3200 }, { name: "Sravya Chintalapudi", batch: B6, fee: 1800 } ] },
  { parent: "Mohammed Rafi", phone: "+919394901234", language: "hi", habit: "SAMEDAY_UPI", dueDay: 10, notes: "Hindi messages. Pays by UPI the same day.", memory: { bestTime: "After Maghrib, around 6:30 pm" },
    kids: [ { name: "Ayaan Rafi", batch: B8, fee: 2400 }, { name: "Zoya Rafi", batch: B6, fee: 1800 } ] },
  { parent: "Rajesh Kumar Sharma", phone: "+917702012345", language: "hi", habit: "ONTIME_CASH", dueDay: 5, notes: "Railway employee, transferred from Bhopal.", memory: { bestTime: "Weekends" },
    kids: [ { name: "Aditi Sharma", batch: B9, fee: 3500 } ] },
  { parent: "Kalyani Reddy", phone: "+919505123456", language: "en", habit: "LATE", dueDay: 15, notes: "Works shifts at the district hospital.", memory: { bestTime: "Late morning" },
    kids: [ { name: "Tanvi Reddy", batch: B8, fee: 2200 }, { name: "Tarun Reddy", batch: B6, fee: 1600 } ] },
  { parent: "Ganesh Patnaik", phone: "+918008234567", language: "te", habit: "SAMEDAY_UPI", dueDay: 10, notes: "", memory: {},
    kids: [ { name: "Lohith Patnaik", batch: B6, fee: 1500 } ] },
  { parent: "Durga Prasad Yalla", phone: "+919849345678", language: "te", habit: "LATE", dueDay: 5, notes: "Farmer; pays after market days.", memory: { bestTime: "Early morning" },
    kids: [ { name: "Hemanth Yalla", batch: B9, fee: 3000 } ] },
  { parent: "Satyanarayana Murthy", phone: "+919866456789", language: "te", habit: "ONTIME_CASH", dueDay: 5, notes: "Retired teacher. Never late.", memory: { bestTime: "Any time" },
    kids: [ { name: "Jahnavi Murthy", batch: B9, fee: 3200 }, { name: "Karthik Murthy", batch: B8, fee: 2400 } ] },
  { parent: "Anitha Vasupalli", phone: "+919959567890", language: "te", habit: "PROMISE", dueDay: 15, notes: "Said she will pay in two days.", memory: { bestTime: "After 6 pm" },
    kids: [ { name: "Rishi Vasupalli", batch: B6, fee: 1800 } ] },
  { parent: "Krishna Mohan Pilla", phone: "+919490678901", language: "en", habit: "SAMEDAY_UPI", dueDay: 10, notes: "", memory: {},
    kids: [ { name: "Varun Pilla", batch: B9, fee: 3000 }, { name: "Varsha Pilla", batch: B6, fee: 1800 } ] },
  { parent: "Nagamani Boddu", phone: "+919703789012", language: "te", habit: "LEFT", dueDay: 10, notes: "Chaitanya left mid-term in October (moved to Visakhapatnam). October fee still pending.", memory: { bestTime: "Evening" },
    kids: [ { name: "Chaitanya Boddu", batch: B8, fee: 2200, active: false } ] },
];

const token = () => randomBytes(12).toString("base64url");

/** Seeds one demo account (userId) with the synthetic centre. Wipes that account's rows first. */
export async function seedDemo(userId: string, now: Date = new Date()) {
  const db = rawDb;
  const own = { userId };
  const today = todayIST(now);
  const months = [-3, -2, -1, 0].map((m) => monthKey(addMonths(monthStart(today), m)));
  const cap = (d: Date) => (d >= today ? addDays(today, -1) : d);

  await db.$transaction([
    db.joinRequest.deleteMany({ where: own }),
    db.agentAction.deleteMany({ where: own }),
    db.agentPlan.deleteMany({ where: own }),
    db.paymentClaim.deleteMany({ where: own }),
    db.payment.deleteMany({ where: own }),
    db.invoice.deleteMany({ where: own }),
    db.reminder.deleteMany({ where: own }),
    db.payPromise.deleteMany({ where: own }),
    db.student.deleteMany({ where: own }),
    db.family.deleteMany({ where: own }),
    db.bill.deleteMany({ where: own }),
    db.keyDate.deleteMany({ where: own }),
    db.settings.deleteMany({ where: own }),
  ]);

  await db.settings.create({
    data: {
      userId,
      tutorName: "Lakshmi Devi",
      centreName: "Lakshmi Teaching Point",
      city: "Vizianagaram",
      upiId: "lakshmi.tuition@okaxis",
      upiName: "Lakshmi Teaching Point",
      startingBalance: 10500,
      autonomy: "ASK",
      monthlyGoal: 45000,
    },
  });

  await db.bill.createMany({
    data: ([
      { name: "Rent", amount: 8000, dueDay: 5, flexible: false },
      { name: "Travel (auto and bus)", amount: 1200, dueDay: 1, flexible: false },
      { name: "Study materials and photocopies", amount: 600, dueDay: 15, flexible: true },
      { name: "Household expenses", amount: 20000, dueDay: 1, flexible: false },
      { name: "Scooty EMI", amount: 3200, dueDay: 7, flexible: false },
      { name: "Whiteboard and furniture instalment", amount: 1500, dueDay: 3, flexible: true },
    ] as { name: string; amount: number; dueDay: number; flexible: boolean }[]).map((b) => ({ ...b, userId })),
  });

  // Key dates: next occurrence of each, relative to today
  const nextOcc = (mm: number, dd: number) => {
    const y = today.getUTCFullYear();
    const d = new Date(Date.UTC(y, mm - 1, dd));
    return d < addDays(today, -15) ? new Date(Date.UTC(y + 1, mm - 1, dd)) : d;
  };
  const span = (mm: number, dd: number, len: number) => {
    const s = nextOcc(mm, dd);
    return { startDate: s, endDate: addDays(s, len) };
  };
  await db.keyDate.createMany({
    data: [
      { name: "Christmas holidays", ...span(12, 24, 2), collectionFactor: 0.8 },
      { name: "Sankranti holidays", ...span(1, 10, 8), collectionFactor: 0.5 },
      { name: "Board exams", ...span(3, 1, 30), collectionFactor: 0.85 },
      { name: "Dasara holidays", ...span(9, 26, 11), collectionFactor: 0.6 },
    ].map((k) => ({ ...k, userId })),
  });

  const seq: Record<string, number> = {};
  const nextNumber = (month: string) => {
    seq[month] = (seq[month] ?? 0) + 1;
    return `LTP-${month}-${String(seq[month]).padStart(3, "0")}`;
  };

  let i = 0;
  for (const f of FAMILIES) {
    i++;
    const family = await db.family.create({
      data: {
        userId,
        parentName: f.parent,
        language: f.language,
        notes: f.notes,
        memory: JSON.stringify(f.memory),
        students: {
          create: f.kids.map((k) => ({ userId, name: k.name, batch: k.batch, monthlyFee: k.fee, dueDay: f.dueDay, active: k.active ?? true })),
        },
      },
    });

    const kidsForMonth = (mi: number) => (f.habit === "LEFT" ? (mi <= 2 ? f.kids.map((k) => ({ ...k, active: true })) : []) : f.kids);

    for (let mi = 0; mi < months.length; mi++) {
      const month = months[mi];
      const kids = kidsForMonth(mi);
      if (!kids.length) continue;
      const due = dateInMonth(month, f.dueDay);
      const gross = kids.reduce((s, k) => s + k.fee, 0);
      const amount = familyMonthlyFee(kids.map((k) => ({ monthlyFee: k.fee, active: true })));
      const sorted = [...kids].sort((a, b) => b.fee - a.fee);
      const lines = sorted.map((k, idx) => ({ name: k.name, batch: k.batch, fee: k.fee, discount: idx === 0 ? 0 : Math.round(k.fee * 0.1) }));
      const isCurrent = mi === 3;
      const isLast = mi === 2;

      type P = { amount: number; date: Date; mode: "CASH" | "UPI"; reference?: string };
      const pays: P[] = [];
      const upiRef = () => String(400000000000 + Math.floor(((i * 7919 + mi * 104729) % 99999999) * 1000 + mi));
      const upi = (d: Date, a = amount): P => ({ amount: a, date: cap(d), mode: "UPI", reference: upiRef() });
      const cash = (d: Date, a = amount): P => ({ amount: a, date: cap(d), mode: "CASH" });

      switch (f.habit) {
        case "ONTIME_CASH": pays.push(cash(addDays(due, -2))); break;
        case "SAMEDAY_UPI": pays.push(upi(due)); break;
        case "LATE": pays.push((mi % 2 ? upi : cash)(addDays(due, 10 + ((i + mi * 3) % 6)))); break;
        case "PAYDAY": pays.push(upi(dateInMonth(month, 17 + (mi % 2)))); break;
        case "CHRONIC":
          if (isCurrent) break;
          if (isLast) { pays.push(cash(addDays(due, 12), 1500)); break; }
          pays.push(cash(addDays(due, 32 + mi * 6)));
          break;
        case "PARTIAL":
          if (isCurrent) { pays.push(cash(addDays(due, 5), amount - 1000)); break; }
          pays.push(cash(addDays(due, 5), Math.round(amount / 2)), upi(addDays(due, 19), amount - Math.round(amount / 2)));
          break;
        case "BREAKER":
          if (isCurrent) break;
          pays.push(upi(addDays(due, isLast ? 23 : 14 + mi * 3)));
          break;
        case "PROMISE":
          if (isCurrent) break;
          pays.push(cash(addDays(due, 8)));
          break;
        case "LEFT":
          if (mi === 2) break; // October-style month left unpaid when the child left
          pays.push(cash(addDays(due, 3)));
          break;
      }

      // payments can never be in the future: drop any that land after today
      const realPays = pays.filter((p) => p.date < today || +p.date === +addDays(today, -1));
      const paidTotal = realPays.reduce((s, p) => s + p.amount, 0);
      const status = paidTotal >= amount ? "PAID" : paidTotal > 0 ? "PARTIAL" : "SENT";

      await db.invoice.create({
        data: {
          userId,
          number: nextNumber(month),
          familyId: family.id,
          month,
          amount,
          discount: gross - amount,
          dueDate: due,
          status,
          payToken: token(),
          lines: JSON.stringify(lines),
          createdAt: addDays(dateInMonth(month, 1), 0),
          payments: { create: realPays.map((p) => ({ userId, amount: p.amount, date: p.date, mode: p.mode, reference: p.reference ?? null })) },
        },
      });

      // Promises and reminders tell the story Munshi reads
      if (f.habit === "BREAKER" && isLast) {
        await db.payPromise.createMany({
          data: [
            { userId, familyId: family.id, promisedDate: addDays(due, 7), amount, kept: false, note: "Said: will pay this weekend" },
            { userId, familyId: family.id, promisedDate: addDays(due, 15), amount, kept: false, note: "Said: after salary, pakka" },
          ],
        });
        await db.reminder.createMany({
          data: [
            { userId, familyId: family.id, tone: "GENTLE", language: f.language, sentAt: addDays(due, 3) },
            { userId, familyId: family.id, tone: "FIRM", language: f.language, sentAt: addDays(due, 17) },
          ],
        });
      }
      if ((f.habit === "LATE" && isLast && i % 2 === 0) || (f.habit === "CHRONIC" && mi === 1)) {
        await db.payPromise.create({
          data: { userId, familyId: family.id, promisedDate: cap(addDays(due, f.habit === "CHRONIC" ? 32 + mi * 6 : 10 + ((i + mi * 3) % 6))), amount, kept: true, note: "Paid on the promised day" },
        });
      }
      if (f.habit === "CHRONIC" && (isLast || isCurrent)) {
        await db.reminder.create({ data: { userId, familyId: family.id, tone: isLast ? "FIRM" : "GENTLE", language: f.language, sentAt: cap(addDays(due, 6)) } });
      }
    }

    if (f.habit === "PROMISE") {
      await db.payPromise.create({
        data: { userId, familyId: family.id, promisedDate: addDays(today, 2), amount: 1800, kept: null, note: "Said on WhatsApp: will pay in two days" },
      });
    }
  }

  // Two parents who joined through the link and wait for the tutor's approval (synthetic)
  await db.joinRequest.createMany({
    data: [
      { userId, parentName: "Bhaskar Rao Tentu", language: "te", kids: JSON.stringify([{ name: "Likhitha Tentu", batch: B8 }]), note: "Joined from the parents' WhatsApp group", createdAt: addDays(now, -1) },
      { userId, parentName: "Farhana Begum", language: "hi", kids: JSON.stringify([{ name: "Arif Shaik", batch: B6 }, { name: "Sana Shaik", batch: B9 }]), note: "", createdAt: now },
    ],
  });

  return { today: fromKey(today.toISOString()), families: FAMILIES.length };
}
