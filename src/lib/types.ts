import type { Platform } from "@/db/schema";

/** A comment as a connector returns it, before it is stored. */
export interface RawComment {
  platform: Platform;
  externalId: string;
  parentExternalId: string | null;
  postExternalId: string;
  postUrl: string | null;
  authorExternalId: string | null;
  authorName: string | null;
  text: string;
  postedAt: Date;
}
