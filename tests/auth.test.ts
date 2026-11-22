import { describe, expect, it } from "vitest";
import { safeNext } from "../src/lib/auth/config";
import { signSession, verifySession } from "../src/lib/auth/token";

process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";

describe("auth", () => {
  it("only allows same-site relative redirects after sign-in", () => {
    expect(safeNext("/owes")).toBe("/owes");
    expect(safeNext("//evil.com")).toBe("/home");
    expect(safeNext("https://evil.com")).toBe("/home");
    expect(safeNext("/\\evil.com")).toBe("/home");
    expect(safeNext("/login")).toBe("/home");
    expect(safeNext(undefined)).toBe("/home");
  });

  it("round-trips a session and rejects tampered or unsigned tokens", async () => {
    const t = await signSession("user_1");
    expect(await verifySession(t)).toBe("user_1");
    expect(await verifySession(t.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySession("eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});
