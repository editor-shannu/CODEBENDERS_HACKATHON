import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/lib/seed-data";

const db = new PrismaClient();

seedDemo(db)
  .then(async () => {
    const unpaid = await db.invoice.findMany({ include: { payments: true } });
    const total = unpaid.reduce((s, i) => s + Math.max(0, i.amount - i.payments.reduce((a, p) => a + p.amount, 0)), 0);
    console.log(`Seeded Lakshmi Teaching Point. Total pending: ₹${total.toLocaleString("en-IN")}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
