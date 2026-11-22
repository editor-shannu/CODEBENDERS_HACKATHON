import "server-only";
import { rawDb } from "./prisma";
import { currentUserId } from "./auth/session";

/*
 * Tenant isolation. `db` is the only client app code uses, and every query it runs is pinned to the
 * signed-in tutor: reads, counts, updates and deletes get `userId` added to their where clause, and
 * creates get `userId` stamped on (nested creates too). A create or update that points at another
 * row by familyId / invoiceId / planId is refused unless that row is the same tutor's. With nobody
 * signed in, every query throws. Public code (sign-in, the parent pay link) uses `rawDb` explicitly.
 */

const TENANT_MODELS = new Set([
  "Settings", "Family", "Student", "Invoice", "Payment", "PaymentClaim", "PayPromise", "Reminder", "Bill", "KeyDate", "AgentPlan", "AgentAction",
]);

const FOREIGN_KEYS: Record<string, "family" | "invoice" | "agentPlan"> = { familyId: "family", invoiceId: "invoice", planId: "agentPlan" };

type Data = Record<string, unknown>;
const isObj = (v: unknown): v is Data => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);

class ForbiddenReferenceError extends Error {
  constructor(field: string) {
    super(`Not found (${field})`);
    this.name = "ForbiddenReferenceError";
  }
}

async function checkForeignKeys(data: Data, uid: string) {
  for (const [field, model] of Object.entries(FOREIGN_KEYS)) {
    const id = data[field];
    if (typeof id !== "string") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const owned = await (rawDb[model] as any).count({ where: { id, userId: uid } });
    if (!owned) throw new ForbiddenReferenceError(field);
  }
}

/** Stamps the owner on a create payload and on any nested create / createMany inside it. */
async function own(data: unknown, uid: string): Promise<Data> {
  if (!isObj(data)) return data as Data;
  await checkForeignKeys(data, uid);
  const out: Data = { ...data, userId: uid };
  for (const [k, v] of Object.entries(out)) {
    if (!isObj(v)) continue;
    const nested: Data = { ...v };
    if ("create" in nested) nested.create = Array.isArray(nested.create) ? await Promise.all(nested.create.map((d) => own(d, uid))) : await own(nested.create, uid);
    if (isObj(nested.createMany) && Array.isArray(nested.createMany.data)) {
      nested.createMany = { ...nested.createMany, data: await Promise.all(nested.createMany.data.map((d: unknown) => own(d, uid))) };
    }
    if ("connect" in nested || "connectOrCreate" in nested || "upsert" in nested) throw new Error(`Nested ${k} links are not allowed through the scoped client`);
    out[k] = nested;
  }
  return out;
}

/** Update payloads may not move a row to another owner, and may only point at the tutor's own rows. */
async function guardUpdate(data: unknown, uid: string): Promise<Data> {
  if (!isObj(data)) return data as Data;
  await checkForeignKeys(data, uid);
  const out: Data = { ...data };
  delete out.userId;
  for (const v of Object.values(out)) {
    if (isObj(v) && ("create" in v || "connect" in v || "createMany" in v || "upsert" in v || "connectOrCreate" in v)) {
      throw new Error("Nested writes in updates are not allowed through the scoped client");
    }
  }
  return out;
}

const scope = (where: unknown, uid: string) => ({ ...(isObj(where) ? where : {}), userId: uid });

export const db = rawDb.$extends({
  name: "tenant",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (model === "User") throw new Error("User rows are only reachable through the auth layer");
        if (!TENANT_MODELS.has(model)) return query(args);
        const uid = await currentUserId();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a: any = { ...(args ?? {}) };
        switch (operation) {
          case "create":
            a.data = await own(a.data, uid);
            break;
          case "createMany":
          case "createManyAndReturn":
            a.data = Array.isArray(a.data) ? await Promise.all(a.data.map((d: unknown) => own(d, uid))) : await own(a.data, uid);
            break;
          case "upsert":
            a.where = scope(a.where, uid);
            a.create = await own(a.create, uid);
            a.update = await guardUpdate(a.update, uid);
            break;
          case "update":
          case "updateMany":
          case "updateManyAndReturn":
            a.where = scope(a.where, uid);
            a.data = await guardUpdate(a.data, uid);
            break;
          default:
            // findUnique(OrThrow), findFirst(OrThrow), findMany, count, aggregate, groupBy, delete, deleteMany
            a.where = scope(a.where, uid);
        }
        return query(a);
      },
    },
  },
});

export type Db = typeof db;
