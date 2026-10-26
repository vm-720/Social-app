import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { slugify } from "@/lib/accounts";
import { isPublicPath } from "@/lib/auth/config";
import { chooseAccount, type AccountAccess } from "@/lib/auth/context";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

describe("token encryption", () => {
  it("round-trips and never stores the plain token", () => {
    const stored = encryptSecret("EAAB-page-token");
    expect(stored).not.toContain("EAAB");
    expect(decryptSecret(stored)).toBe("EAAB-page-token");
  });
  it("rejects a tampered value", () => {
    const [v, iv, tag, ct] = encryptSecret("secret").split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
  });
  it("rejects plain text", () => {
    expect(() => decryptSecret("EAAB-page-token")).toThrow();
  });
});

describe("chooseAccount", () => {
  const a = (id: string): AccountAccess => ({ account: { id } as AccountAccess["account"], role: "member" });
  it("uses the cookie's account only when the user belongs to it", () => {
    expect(chooseAccount([a("1"), a("2")], "2")?.account.id).toBe("2");
    expect(chooseAccount([a("1"), a("2")], "someone-elses")?.account.id).toBe("1");
    expect(chooseAccount([], "1")).toBeNull();
  });
});

describe("public paths", () => {
  it("only lets login, auth links and the cron route through without a session", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/api/cron/sync")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});

describe("slugify", () => {
  it("makes a readable, unique slug", () => {
    const s = slugify("AAA Western & Central NY!");
    expect(s).toMatch(/^aaa-western-central-ny-[0-9a-f]{6}$/);
    expect(slugify("AAA Western & Central NY!")).not.toBe(s);
  });
});

describe("token encryption key formats", () => {
  it("accepts a long passphrase as well as base64 bytes", () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "correct-horse-battery-staple-and-more-words";
    expect(decryptSecret(encryptSecret("t"))).toBe("t");
    process.env.TOKEN_ENCRYPTION_KEY = "too-short";
    expect(() => encryptSecret("t")).toThrow();
    process.env.TOKEN_ENCRYPTION_KEY = saved;
  });
});
