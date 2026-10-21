// POST /api/auth/recovery/verify-code — paso 2: comprueba el código de 6 dígitos contra el
// hash guardado y marca la cookie `verified` (vale 10 min).
import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/appwrite.js";
import { getRecoveryChallenge, hashRecoverySecret } from "@/lib/recovery.js";

export async function POST(req) {
  const form = await req.formData();
  const secret = String(form.get("secret") ?? "").trim();
  const challenge = await getRecoveryChallenge(req.cookies);

  if (!challenge || !/^\d{6}$/.test(secret) || hashRecoverySecret(secret) !== challenge.row.secretHash) {
    return NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&error=verify`, 303);
  }

  const response = NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&verified=1`, 303);
  response.cookies.set("agentsolver_recovery_verified", "1", {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
