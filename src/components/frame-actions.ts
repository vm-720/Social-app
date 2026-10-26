"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { ACCOUNT_COOKIE, isMember } from "@/lib/auth/context";
import { getSessionUser } from "@/lib/auth/server";

export async function switchAccount(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const accountId = String(formData.get("accountId"));
  if (await isMember(getDb(), user.id, accountId)) {
    (await cookies()).set(ACCOUNT_COOKIE, accountId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  redirect("/dashboard");
}
