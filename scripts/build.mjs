// Build used locally and on Vercel.
// 1. Always regenerate the Prisma client (Vercel caches node_modules, which leaves a stale client).
// 2. If DATABASE_URL is set, run the one-time pre-sign-in cleanup (drops only an ownerless legacy demo
//    database), then sync the schema so tables exist on first deploy.
// 3. Build Next.js.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run("npx prisma generate");
if (process.env.DATABASE_URL) {
  run("npx prisma db execute --schema prisma/schema.prisma --file scripts/pre-auth-migrate.sql");
  run("npx prisma db push --skip-generate");
} else {
  console.warn("\n[baaki] DATABASE_URL is not set: skipping `prisma db push`. The app will show a setup screen until it is.\n");
}
run("npx next build");
