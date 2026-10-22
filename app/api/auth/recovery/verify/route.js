// POST /api/auth/recovery/verify — paso 3: con el código ya verificado, fija la nueva contraseña
// (mín. 8 caracteres) y limpia las cookies del reto.
import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { adminClient, APP_URL } from "@/lib/appwrite.js";
import { clearRecoveryCookies, getRecoveryChallenge } from "@/lib/recovery.js";

const toStep = (error) => NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&verified=1&error=${error}`, 303);

export async function POST(req) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const passwordAgain = String(form.get("passwordAgain") ?? "");
  const challenge = await getRecoveryChallenge(req.cookies);
  const verified = req.cookies.get("agentsolver_recovery_verified")?.value === "1";

  if (!challenge || !verified) return NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&error=verify`, 303);
  // Los errores de contraseña mantienen `verified=1`: el código ya está validado y el usuario solo debe reintentar la contraseña.
  if (password !== passwordAgain) return toStep("mismatch");
  if (password.length < 8) return toStep("policy");

  try {
    await new Account(adminClient()).updateRecoveryOTP({ userId: challenge.userId, secret: challenge.secret, password });
    const response = NextResponse.redirect(`${APP_URL}/login?reset=success`, 303);
    return clearRecoveryCookies(response);
  } catch (error) {
    // 400 = Appwrite rechaza la contraseña (política, diccionario, datos personales, reutilizada); el resto = código caducado o inválido.
    if (error?.code === 400) return toStep("policy");
    return NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&error=verify`, 303);
  }
}
