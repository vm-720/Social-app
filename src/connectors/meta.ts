import type { Connection } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import type { RawComment } from "@/lib/types";
import type { Connector } from "./types";

// Facebook Pages and Instagram professional accounts through the Meta Graph API.
// Needs a Page access token with pages_read_engagement + pages_read_user_content (Facebook)
// and instagram_basic + instagram_manage_comments (Instagram).

const MAX_POSTS = 50;

function graphBase() {
  return `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}`;
}

interface Page<T> {
  data: T[];
  paging?: { next?: string };
}

async function graphGet<T>(url: string): Promise<Page<T>> {
  const res = await fetch(url);
  const body = (await res.json()) as Page<T> & { error?: { message: string; code: number } };
  if (!res.ok || body.error) {
    throw new Error(`Graph API ${res.status}: ${body.error?.message ?? "unknown error"}`);
  }
  return body;
}

async function graphAll<T>(path: string, params: Record<string, string>, token: string, limit = Infinity): Promise<T[]> {
  const qs = new URLSearchParams({ ...params, access_token: token, limit: "100" });
  let next: string | undefined = `${graphBase()}/${path}?${qs}`;
  const out: T[] = [];
  while (next && out.length < limit) {
    const page: Page<T> = await graphGet<T>(next);
    out.push(...page.data);
    next = page.paging?.next;
  }
  return out.slice(0, limit);
}

function requireToken(c: Connection): string {
  if (!c.accessToken) throw new Error(`Connection ${c.displayName} has no access token`);
  return decryptSecret(c.accessToken);
}

interface FbPost {
  id: string;
  permalink_url?: string;
}
interface FbComment {
  id: string;
  message?: string;
  created_time: string;
  from?: { id: string; name: string };
  parent?: { id: string };
}

export const facebookConnector: Connector = {
  async fetchComments(c, since) {
    const token = requireToken(c);
    // Comments keep arriving on older posts, so look back over recent posts, not only new ones.
    const posts = await graphAll<FbPost>(`${c.externalId}/posts`, { fields: "id,permalink_url" }, token, MAX_POSTS);
    const out: RawComment[] = [];
    for (const post of posts) {
      const comments = await graphAll<FbComment>(
        `${post.id}/comments`,
        { fields: "id,message,created_time,from,parent{id}", filter: "stream", order: "reverse_chronological" },
        token,
      );
      for (const cm of comments) {
        const postedAt = new Date(cm.created_time);
        if (since && postedAt <= since) break; // reverse chronological: the rest are older
        if (!cm.message) continue; // sticker or photo only
        out.push({
          platform: "facebook",
          externalId: cm.id,
          parentExternalId: cm.parent?.id ?? null,
          postExternalId: post.id,
          postUrl: post.permalink_url ?? null,
          authorExternalId: cm.from?.id ?? null,
          authorName: cm.from?.name ?? null,
          text: cm.message,
          postedAt,
        });
      }
    }
    return out;
  },
};

interface IgMedia {
  id: string;
  permalink?: string;
}
interface IgComment {
  id: string;
  text?: string;
  timestamp: string;
  username?: string;
  from?: { id: string; username: string };
  replies?: { data: IgComment[] };
}

export const instagramConnector: Connector = {
  async fetchComments(c, since) {
    const token = requireToken(c);
    const media = await graphAll<IgMedia>(`${c.externalId}/media`, { fields: "id,permalink" }, token, MAX_POSTS);
    const out: RawComment[] = [];
    const push = (cm: IgComment, m: IgMedia, parent: string | null) => {
      const postedAt = new Date(cm.timestamp);
      if ((since && postedAt <= since) || !cm.text) return;
      out.push({
        platform: "instagram",
        externalId: cm.id,
        parentExternalId: parent,
        postExternalId: m.id,
        postUrl: m.permalink ?? null,
        authorExternalId: cm.from?.id ?? null,
        authorName: cm.from?.username ?? cm.username ?? null,
        text: cm.text,
        postedAt,
      });
    };
    for (const m of media) {
      const comments = await graphAll<IgComment>(
        `${m.id}/comments`,
        { fields: "id,text,timestamp,username,from,replies{id,text,timestamp,username,from}" },
        token,
      );
      for (const cm of comments) {
        push(cm, m, null);
        for (const r of cm.replies?.data ?? []) push(r, m, cm.id);
      }
    }
    return out;
  },
};
