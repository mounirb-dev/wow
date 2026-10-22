// POST /api/account/email/resend — vuelve a mandar el enlace de verificación al email actual de la cuenta.
import { NextResponse } from "next/server";
import { sendEmailVerification } from "@/lib/email-verification.js";
import { COOKIE } from "@/lib/session.js";

export async function POST(req) {
  const secret = req.cookies.get(COOKIE)?.value;
  if (!secret) return NextResponse.json({ error: "Inicia sesión para pedir el enlace" }, { status: 401 });
  try {
    await sendEmailVerification(secret);
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: "No se pudo enviar el enlace. Inténtalo en unos minutos" }, { status: 500 });
  }
}
