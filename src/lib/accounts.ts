import crypto from "node:crypto";
import type { Db } from "@/db/client";
import { accounts, memberships, topics } from "@/db/schema";
import type { SessionUser } from "./auth/config";

/** A starting topic list that fits most consumer-facing businesses. Owners edit it in Settings. */
export const DEFAULT_TOPICS: { name: string; description: string }[] = [
  { name: "Product or service quality", description: "How well the product or service works" },
  { name: "Customer service", description: "Phone, in-person, chat and email support" },
  { name: "Pricing and value", description: "Prices, fees, discounts and whether it is worth it" },
  { name: "Staff", description: "Comments about specific employees or team behaviour" },
  { name: "Locations and hours", description: "Branches, stores, opening hours, parking" },
  { name: "Website and app", description: "Online ordering, accounts, app problems" },
  { name: "Marketing and content", description: "Reactions to posts, ads, promotions and events" },
];

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "business"}-${crypto.randomBytes(3).toString("hex")}`;
}

export async function createAccount(db: Db, name: string, owner: SessionUser) {
  const [account] = await db.insert(accounts).values({ name, slug: slugify(name) }).returning();
  await db.insert(memberships).values({ accountId: account.id, userId: owner.id, email: owner.email, role: "owner" });
  await db.insert(topics).values(DEFAULT_TOPICS.map((t, i) => ({ ...t, accountId: account.id, sortOrder: i })));
  return account;
}
