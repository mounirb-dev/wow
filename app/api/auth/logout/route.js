import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/appwrite.js";
import { COOKIE } from "@/lib/session.js";

export async function POST() {
  const res = NextResponse.redirect(`${APP_URL}/login`, 303);
  res.cookies.delete(COOKIE);
  return res;
}
