import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/appwrite.js";
import { issueRecoveryChallenge, recoveryCookies } from "@/lib/recovery.js";

export async function POST(req) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  if (!email) return NextResponse.redirect(`${APP_URL}/forgot-password?error=email`, 303);

  try {
    const token = await issueRecoveryChallenge(email);
    const response = NextResponse.redirect(`${APP_URL}/forgot-password?sent=1`, 303);
    return recoveryCookies(response, token, email);
  } catch {
    return NextResponse.redirect(`${APP_URL}/forgot-password?error=send`, 303);
  }
}
