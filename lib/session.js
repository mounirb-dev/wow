import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Account } from "node-appwrite";
import { sessionClient } from "./appwrite.js";

export const COOKIE = "as_session";

export const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || process.env.APP_URL?.startsWith("https://"), path: "/", maxAge: 60 * 60 * 24 * 30 };

// cache(): one Appwrite round-trip per request, however many helpers ask for the user.
export const getUser = cache(async () => {
  const secret = (await cookies()).get(COOKIE)?.value;
  if (!secret) return null;
  try {
    return await new Account(sessionClient(secret)).get();
  } catch {
    return null;
  }
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
