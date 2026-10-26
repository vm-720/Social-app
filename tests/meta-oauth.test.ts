import { afterEach, describe, expect, it } from "vitest";
import { authorizeUrl, checkState, connectionsFromPages, newState, redirectUri } from "@/lib/meta-oauth";

afterEach(() => {
  delete process.env.APP_URL;
  delete process.env.META_LOGIN_CONFIG_ID;
});

describe("OAuth state", () => {
  it("returns the business id when the state matches the cookie", () => {
    const { nonce, cookie } = newState("acct-1");
    expect(checkState(cookie, nonce)).toBe("acct-1");
  });
  it("rejects a missing, forged or mismatched state", () => {
    const { cookie } = newState("acct-1");
    const other = newState("acct-1");
    expect(checkState(cookie, other.nonce)).toBeNull();
    expect(checkState(undefined, other.nonce)).toBeNull();
    expect(checkState(cookie, null)).toBeNull();
    expect(checkState("garbage", "garbage")).toBeNull();
  });
});

describe("authorize URL", () => {
  it("asks for the read permissions and the registered redirect", () => {
    process.env.META_APP_ID = "123";
    process.env.APP_URL = "https://app.example.com/";
    const url = new URL(authorizeUrl("s1", redirectUri("https://preview-xyz.vercel.app")));
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/connect/meta/callback");
    expect(url.searchParams.get("scope")).toContain("pages_read_user_content");
    expect(url.searchParams.get("state")).toBe("s1");
  });
  it("uses a login configuration instead of scopes when one is set", () => {
    process.env.META_LOGIN_CONFIG_ID = "cfg";
    const url = new URL(authorizeUrl("s1", "https://x/cb"));
    expect(url.searchParams.get("config_id")).toBe("cfg");
    expect(url.searchParams.has("scope")).toBe(false);
  });
});

describe("connectionsFromPages", () => {
  it("adds the linked Instagram account using the Page token", () => {
    const out = connectionsFromPages([
      { id: "p1", name: "AAA WCNY", username: "aaawcny", access_token: "t1", instagram_business_account: { id: "ig1", username: "aaa_wcny" } },
      { id: "p2", name: "Other Page", access_token: "t2" },
    ]);
    expect(out).toEqual([
      { platform: "facebook", externalId: "p1", displayName: "AAA WCNY", handle: "aaawcny", token: "t1" },
      { platform: "instagram", externalId: "ig1", displayName: "@aaa_wcny", handle: "aaa_wcny", token: "t1" },
      { platform: "facebook", externalId: "p2", displayName: "Other Page", handle: null, token: "t2" },
    ]);
  });
});
