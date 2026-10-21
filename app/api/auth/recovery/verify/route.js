// POST /api/auth/recovery/verify — paso 3: con el código ya verificado, fija la nueva contraseña
// (mín. 8 caracteres) y limpia las cookies del reto.
import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { adminClient, APP_URL } from "@/lib/appwrite.js";
import { clearRecoveryCookies, getRecoveryChallenge } from "@/lib/recovery.js";

export async function POST(req) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const passwordAgain = String(form.get("passwordAgain") ?? "");
  const challenge = await getRecoveryChallenge(req.cookies);
  const verified = req.cookies.get("agentsolver_recovery_verified")?.value === "1";

  if (!challenge || !verified) return NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&error=verify`, 303);
  if (password.length < 8 || password !== passwordAgain) return NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&error=password`, 303);

  try {
    await new Account(adminClient()).updateRecoveryOTP({ userId: challenge.userId, secret: challenge.secret, password });
    const response = NextResponse.redirect(`${APP_URL}/login?reset=success`, 303);
    return clearRecoveryCookies(response);
  } catch {
    return NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&error=verify`, 303);
  }
}
