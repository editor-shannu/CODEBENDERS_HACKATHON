import type { HouseState } from "@/components/ui/HouseStatus";

/** One house on the lane = one family. */
export type LandingFamily = {
  id: string;
  name: string;
  kids: string;
  amount: number; // this month's fee for the family, whole rupees
  status: HouseState;
};

export type LandingData = {
  source: "live" | "demo";
  centre: string;
  tutor: string;
  families: LandingFamily[]; // at most 12
  collected: number;
  owed: number;
  rent: { name: string; amount: number; dueDay: number } | null;
  munshiNote: string;
  defense: string[]; // ids of up to three owing houses Munshi chases to keep rent safe
};

export const MAX_HOUSES = 12;

/** Static demo lane, used whenever the database is empty or unreachable so the landing never breaks. */
export const DEMO_LANDING: LandingData = {
  source: "demo",
  centre: "Lakshmi Teaching Point",
  tutor: "Lakshmi Devi",
  families: [
    { id: "d1", name: "Ravi Kumar", kids: "Anil", amount: 1800, status: "promised" },
    { id: "d2", name: "Sunitha Reddy", kids: "Divya and Kiran", amount: 3240, status: "paid" },
    { id: "d3", name: "Imran Khan", kids: "Ayaan", amount: 1500, status: "owed" },
    { id: "d4", name: "Padma Rao", kids: "Sravya", amount: 2000, status: "paid" },
    { id: "d5", name: "Venkat Naidu", kids: "Harsha", amount: 1800, status: "owed" },
    { id: "d6", name: "Fatima Begum", kids: "Sana", amount: 1500, status: "paid" },
    { id: "d7", name: "Srinivas Goud", kids: "Teja and Bhavya", amount: 3240, status: "promised" },
    { id: "d8", name: "Lalitha Sharma", kids: "Meghana", amount: 2000, status: "paid" },
    { id: "d9", name: "Rajesh Varma", kids: "Nikhil", amount: 1800, status: "owed" },
    { id: "d10", name: "Anjali Patel", kids: "Riya", amount: 1500, status: "paid" },
  ],
  collected: 10500,
  owed: 11640,
  rent: { name: "Rent", amount: 8000, dueDay: 30 },
  munshiNote: "Ravi said after salary, the 5th. I'll remind him on the 6th.",
  defense: ["d3", "d5", "d9"],
};

export type Chapter = { id: string; day: string; title: string; body: string };

export function chaptersFor(d: LandingData): Chapter[] {
  const paid = d.families.filter((f) => f.status === "paid").length;
  return [
    { id: "day-1", day: "Day 1", title: "Every rupee you're owed, on one street.", body: `${d.families.length} families, one lane, one tuition centre. Every house is a family. Every window is a fee.` },
    { id: "day-5", day: "Day 5", title: "The invoices go out.", body: "One slip to every doorstep, with a UPI link inside. No notebook, no chasing yet." },
    { id: "day-10", day: "Day 10", title: "Lit means paid.", body: `${paid} of ${d.families.length} windows are lit. Baaki counts what's in and what's still out, live.` },
    { id: "day-15", day: "Day 15", title: "A dim lamp is a promise.", body: `Munshi's note: "${d.munshiNote}"` },
    { id: "day-20", day: "Day 20", title: "Clouds, if rent is at risk.", body: d.rent ? `${d.rent.name} is due on the ${ordinal(d.rent.dueDay)}. The clock on the centre's wall shows how many days it's safe.` : "The clock on the centre's wall shows how many days your bills are safe." },
    { id: "day-25", day: "Day 25", title: "The Rent Defense Plan.", body: "Munshi draws a line through the three houses that cover rent, and chases them in the right tone, in their own language." },
    { id: "rent-day", day: "Rent day", title: "Rent's safe. Go teach.", body: "Every window lit. Nothing left in the notebook." },
    { id: "select", day: "Tonight", title: "Who's this for?", body: `${d.centre}, run by ${d.tutor}.` },
  ];
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** How each house looks in a chapter (index into chaptersFor). */
export function houseStateAt(chapter: number, f: LandingFamily, defense: string[]): HouseState {
  if (chapter <= 1) return "owed";
  if (chapter >= 6) return "paid";
  if (f.status === "paid") return "paid";
  if (chapter === 5 && defense.includes(f.id)) return "paid";
  if (chapter >= 3 && f.status === "promised") return "promised";
  return "owed";
}
