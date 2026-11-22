// One-time local setup helper used by setup.bat / setup.sh.
// Creates .env from .env.example, generates AUTH_SECRET, and fills DATABASE_URL.
import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline/promises";

const useDocker = process.argv.includes("--docker");
const LOCAL_DB = "postgresql://baaki:baaki@localhost:5432/baaki";

if (!fs.existsSync(".env")) {
  fs.copyFileSync(".env.example", ".env");
  console.log("[baaki] Created .env from .env.example");
}
let env = fs.readFileSync(".env", "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=\"?([^\"\\n]*)\"?`, "m")) || [])[1] || "";
const set = (k, v) => {
  const line = `${k}="${v}"`;
  env = new RegExp(`^${k}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), line) : `${env.trimEnd()}\n${line}\n`;
};

if (!get("AUTH_SECRET")) {
  set("AUTH_SECRET", crypto.randomBytes(48).toString("base64"));
  console.log("[baaki] Generated AUTH_SECRET");
}

const db = get("DATABASE_URL");
if (!db || db.includes("USER:PASSWORD@HOST")) {
  if (useDocker) {
    set("DATABASE_URL", LOCAL_DB);
    console.log("[baaki] Using local Docker Postgres");
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n[baaki] A PostgreSQL database is needed.");
    console.log("        Free option: create one at https://neon.tech and copy its connection string.");
    const url = (await rl.question("Paste your DATABASE_URL (postgresql://...): ")).trim();
    rl.close();
    if (!url.startsWith("postgres")) {
      console.error("[baaki] That does not look like a Postgres URL. Edit DATABASE_URL in .env and run setup again.");
      fs.writeFileSync(".env", env);
      process.exit(1);
    }
    set("DATABASE_URL", url);
  }
}

if (!get("LLM_API_KEY")) {
  console.log("[baaki] LLM_API_KEY is empty: Munshi will run in offline rules mode. Add a free Groq key in .env for AI replies.");
}
fs.writeFileSync(".env", env);
console.log("[baaki] .env is ready");
