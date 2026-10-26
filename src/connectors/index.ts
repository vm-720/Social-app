import type { Connection } from "@/db/schema";
import type { RawComment } from "@/lib/types";
import { DEMO_COMMENTS } from "./demo-data";
import { facebookConnector, instagramConnector } from "./meta";
import type { Connector } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Replays the sample comments for one platform. Dedupe on external id keeps re-runs harmless. */
export const demoConnector: Connector = {
  async fetchComments(c) {
    const now = Date.now();
    return DEMO_COMMENTS.filter((d) => d.platform === c.platform).map(
      (d): RawComment => ({
        platform: d.platform,
        externalId: d.id,
        parentExternalId: d.parent ?? null,
        postExternalId: d.post,
        postUrl: null,
        authorExternalId: d.authorId,
        authorName: d.author,
        text: d.text,
        postedAt: new Date(now - d.daysAgo * DAY_MS),
      }),
    );
  },
};

export function connectorFor(c: Connection): Connector | null {
  if (c.isDemo) return demoConnector;
  switch (c.platform) {
    case "facebook":
      return facebookConnector;
    case "instagram":
      return instagramConnector;
    // LinkedIn and TikTok connectors land once their developer apps are approved.
    default:
      return null;
  }
}
