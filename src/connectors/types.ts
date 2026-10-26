import type { Connection } from "@/db/schema";
import type { RawComment } from "@/lib/types";

export interface Connector {
  /** Returns comments posted after `since` (all available when null), including the page's own replies. */
  fetchComments(connection: Connection, since: Date | null): Promise<RawComment[]>;
}
