import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { adminClient, APP_URL } from "@/lib/appwrite.js";
import { COOKIE, cookieOptions } from "@/lib/session.js";

export async function POST() {
  try {
    const session = await new Account(adminClient()).createEmailPasswordSession({
      email: process.env.DEMO_EMAIL,
      password: process.env.DEMO_PASSWORD,
    });
    const res = NextResponse.redirect(`${APP_URL}/`, 303);
    res.cookies.set(COOKIE, session.secret, cookieOptions);
    return res;
  } catch (e) {
    return NextResponse.redirect(`${APP_URL}/login?error=${encodeURIComponent(e.message)}`, 303);
  }
}
