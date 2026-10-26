import type { RawComment } from "./types";

export interface OwnIdentity {
  /** The connected page or account id on the platform. */
  externalId: string;
  /** The page's handle or username, when the platform exposes one. */
  handle: string | null;
  /** Staff or agency author ids that also count as the business. */
  extraAuthorIds: string[];
}

function normalizeHandle(h: string) {
  return h.trim().replace(/^@/, "").toLowerCase();
}

/**
 * True when the business itself wrote the comment. Matches on the platform author id first,
 * then on handle, never on display name (anyone can call themselves "AAA").
 */
export function isOwnComment(comment: Pick<RawComment, "authorExternalId" | "authorName">, own: OwnIdentity): boolean {
  const author = comment.authorExternalId;
  if (author && (author === own.externalId || own.extraAuthorIds.includes(author))) return true;
  if (own.handle && comment.authorName && normalizeHandle(comment.authorName) === normalizeHandle(own.handle)) {
    return true;
  }
  return false;
}
