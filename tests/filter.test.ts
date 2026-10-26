import { describe, expect, it } from "vitest";
import { isOwnComment } from "@/lib/filter";

const own = { externalId: "page-1", handle: "@AAAWCNY", extraAuthorIds: ["agency-9"] };

describe("isOwnComment", () => {
  it("matches the page's own author id", () => {
    expect(isOwnComment({ authorExternalId: "page-1", authorName: "Anything" }, own)).toBe(true);
  });
  it("matches staff or agency ids", () => {
    expect(isOwnComment({ authorExternalId: "agency-9", authorName: null }, own)).toBe(true);
  });
  it("matches the handle case-insensitively without the @", () => {
    expect(isOwnComment({ authorExternalId: null, authorName: "aaawcny" }, own)).toBe(true);
  });
  it("does not trust a look-alike display name", () => {
    expect(isOwnComment({ authorExternalId: "user-5", authorName: "AAA WCNY Official" }, own)).toBe(false);
  });
  it("treats unknown authors as the public", () => {
    expect(isOwnComment({ authorExternalId: null, authorName: null }, own)).toBe(false);
  });
});
