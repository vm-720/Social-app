"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { createAccount } from "@/lib/accounts";
import { ACCOUNT_COOKIE } from "@/lib/auth/context";
import { getSessionUser } from "@/lib/auth/server";

export async function createBusiness(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) redirect("/onboarding");
  const account = await createAccount(getDb(), name, user);
  (await cookies()).set(ACCOUNT_COOKIE, account.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect("/dashboard");
}
