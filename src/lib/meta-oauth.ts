import crypto from "node:crypto";

// "Connect Facebook & Instagram": Facebook Login hands back a code, the code becomes a long-lived
// user token, and that token lists the Pages the person granted, each with its own Page token
// (which does not expire) and any Instagram professional account linked to it.

export const META_STATE_COOKIE = "meta_oauth_state";
export const META_CALLBACK_PATH = "/api/connect/meta/callback";

/** Read comments on Pages and on their linked Instagram accounts. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "business_management",
  "instagram_basic",
  "instagram_manage_comments",
];

function version() {
  return process.env.META_GRAPH_VERSION || "v23.0";
}

export function metaConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

/** APP_URL wins so the redirect address matches the one registered with Meta, whatever host served the request. */
export function redirectUri(requestOrigin: string) {
  return `${(process.env.APP_URL || requestOrigin).replace(/\/+$/, "")}${META_CALLBACK_PATH}`;
}

/** The state value goes to Facebook; the cookie ties it to this browser and this business. */
export function newState(accountId: string) {
  const nonce = crypto.randomBytes(24).toString("base64url");
  return { nonce, cookie: `${nonce}.${accountId}` };
}

export function checkState(cookie: string | undefined, returned: string | null): string | null {
  if (!cookie || !returned) return null;
  const dot = cookie.indexOf(".");
  if (dot < 1) return null;
  const nonce = cookie.slice(0, dot);
  const a = Buffer.from(nonce);
  const b = Buffer.from(returned);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return cookie.slice(dot + 1) || null;
}

export function authorizeUrl(state: string, redirect: string) {
  const qs = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirect,
    state,
    response_type: "code",
  });
  // Business-type apps using Facebook Login for Business name their permissions in a configuration.
  if (process.env.META_LOGIN_CONFIG_ID) qs.set("config_id", process.env.META_LOGIN_CONFIG_ID);
  else qs.set("scope", META_SCOPES.join(","));
  return `https://www.facebook.com/${version()}/dialog/oauth?${qs}`;
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/${version()}/${path}?${new URLSearchParams(params)}`);
  const body = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || body.error) throw new Error(`Graph API ${res.status}: ${body.error?.message ?? "unknown error"}`);
  return body;
}

export async function exchangeCode(code: string, redirect: string): Promise<string> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const short = await graph<{ access_token: string }>("oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirect,
    code,
  });
  const long = await graph<{ access_token: string }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: short.access_token,
  });
  return long.access_token;
}

export interface GrantedPage {
  id: string;
  name: string;
  username?: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
}

export async function grantedPages(userToken: string): Promise<GrantedPage[]> {
  const out: GrantedPage[] = [];
  let after: string | undefined;
  for (let i = 0; i < 10; i++) {
    const params: Record<string, string> = {
      fields: "id,name,username,access_token,instagram_business_account{id,username,name}",
      limit: "100",
      access_token: userToken,
    };
    if (after) params.after = after;
    const page = await graph<{ data: GrantedPage[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      "me/accounts",
      params,
    );
    out.push(...page.data);
    after = page.paging?.cursors?.after;
    if (!page.paging?.next || !after) break;
  }
  return out;
}

export interface NewConnection {
  platform: "facebook" | "instagram";
  externalId: string;
  displayName: string;
  handle: string | null;
  token: string;
}

/** One Facebook connection per Page, plus one Instagram connection per linked account, both read with the Page token. */
export function connectionsFromPages(pages: GrantedPage[]): NewConnection[] {
  return pages.flatMap((p) => {
    const fb: NewConnection = {
      platform: "facebook",
      externalId: p.id,
      displayName: p.name,
      handle: p.username ?? null,
      token: p.access_token,
    };
    const ig = p.instagram_business_account;
    if (!ig) return [fb];
    return [
      fb,
      {
        platform: "instagram",
        externalId: ig.id,
        displayName: ig.username ? `@${ig.username}` : (ig.name ?? `${p.name} Instagram`),
        handle: ig.username ?? null,
        token: p.access_token,
      },
    ];
  });
}
