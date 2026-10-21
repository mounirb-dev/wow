import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { adminClient, APP_URL } from "@/lib/appwrite.js";
import { COOKIE, cookieOptions } from "@/lib/session.js";

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  try {
    const session = await new Account(adminClient()).createSession({ userId: q.get("userId"), secret: q.get("secret") });
    const res = NextResponse.redirect(`${APP_URL}/`);
    res.cookies.set(COOKIE, session.secret, cookieOptions);
    return res;
  } catch (e) {
    return NextResponse.redirect(`${APP_URL}/login?error=${encodeURIComponent(e.message)}`);
  }
}
