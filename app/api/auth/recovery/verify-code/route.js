// POST /api/auth/recovery/verify-code — paso 2: comprueba el código de 6 dígitos contra el
// hash guardado y marca la cookie `verified` (vale 10 min).
import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/appwrite.js";
import { getRecoveryChallenge, hashRecoverySecret } from "@/lib/recovery.js";

export async function POST(req) {
  // Cualquier fallo (sin reto activo, código mal formado o que no coincide) vuelve al mismo paso con el
  // mismo error genérico, para no revelar si el reto existía. Se compara el hash, nunca el código en claro.
  const form = await req.formData();
  const secret = String(form.get("secret") ?? "").trim();
  const challenge = await getRecoveryChallenge(req.cookies);

  if (!challenge || !/^\d{6}$/.test(secret) || hashRecoverySecret(secret) !== challenge.row.secretHash) {
    return NextResponse.redirect(`${APP_URL}/forgot-password?sent=1&error=verify`, 303);
  }

  // Código correcto: cookie httpOnly de 10 min que autoriza el paso 3 (elegir la contraseña nueva).
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
