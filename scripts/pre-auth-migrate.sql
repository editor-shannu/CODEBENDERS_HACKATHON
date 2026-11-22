-- One-time upgrade to multi-tenant Baaki (Google sign-in). A database from before sign-in has no
-- "User" table; its rows are the old synthetic demo centre with no owner, so they are dropped and
-- `prisma db push` recreates the tables empty. Databases that already have "User" are never touched.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    DROP TABLE IF EXISTS "AgentAction", "AgentPlan", "KeyDate", "Bill", "Reminder", "PayPromise", "PaymentClaim", "Payment", "Invoice", "Student", "Family", "Settings" CASCADE;
  END IF;
END $$;
