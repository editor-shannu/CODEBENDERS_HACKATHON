import { z } from "zod";

export const LANGUAGES = ["en", "te", "hi"] as const;
/** Suggested batch names; a tutor may type any batch or class name. */
export const BATCHES = ["Class 6-7 Evening", "Class 8 Maths", "Class 9-10 Board Prep"] as const;
export const MODES = ["CASH", "UPI"] as const;
export const TONES = ["GENTLE", "FIRM", "FINAL"] as const;
export const AUTONOMY = ["SUGGEST", "ASK", "AUTO"] as const;

export const studentSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  batch: z.string().trim().min(1, "Add the class or batch").max(40),
  monthlyFee: z.coerce.number().int().min(100, "Fee looks too low").max(50000),
  dueDay: z.coerce.number().int().min(1).max(28),
  familyId: z.string().optional(),
  parentName: z.string().trim().optional(),
  language: z.enum(LANGUAGES).optional(),
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().int().min(1, "Amount must be at least ₹1"),
  mode: z.enum(MODES),
  reference: z.string().trim().max(40).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const promiseSchema = z.object({
  familyId: z.string().min(1),
  promisedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().int().min(1),
  note: z.string().max(200).optional(),
});

export const billSchema = z.object({
  name: z.string().trim().min(2),
  amount: z.coerce.number().int().min(1),
  dueDay: z.coerce.number().int().min(1).max(28),
  flexible: z.boolean().optional(),
});

export const settingsSchema = z.object({
  tutorName: z.string().trim().min(2),
  centreName: z.string().trim().min(2),
  upiId: z.string().trim().regex(/^[\w.-]+@[\w.-]+$/, "UPI ID looks like name@bank"),
  upiName: z.string().trim().min(2),
  startingBalance: z.coerce.number().int(),
  autonomy: z.enum(AUTONOMY),
  monthlyGoal: z.coerce.number().int().min(0).max(10_000_000).default(0),
});

export const claimSchema = z.object({
  token: z.string().min(8),
  amount: z.coerce.number().int().min(1),
  reference: z.string().trim().min(6, "Enter the UPI reference / UTR number").max(40),
});
