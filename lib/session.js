import { cookies } from "next/headers";
import { Account } from "node-appwrite";
import { sessionClient } from "./appwrite.js";

export const COOKIE = "as_session";

export const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || process.env.APP_URL?.startsWith("https://"), path: "/", maxAge: 60 * 60 * 24 * 30 };

export async function getUser() {
  const secret = (await cookies()).get(COOKIE)?.value;
  if (!secret) return null;
  try {
    return await new Account(sessionClient(secret)).get();
  } catch {
    return null;
  }
}
