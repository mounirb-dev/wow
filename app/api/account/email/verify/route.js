// GET /api/account/email/verify?userId=…&secret=… — destino del enlace del email de verificación. Marca el email
// como verificado y enseña el resultado en /email-confirmado. No necesita sesión: el secreto ya prueba que
// quien abre el enlace recibió el email.
import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { adminClient, APP_URL } from "@/lib/appwrite.js";

export async function GET(req) {
  const userId = req.nextUrl.searchParams.get("userId") ?? "";
  const secret = req.nextUrl.searchParams.get("secret") ?? "";
  let ok = false;
  if (userId && secret) ok = await new Account(adminClient()).updateVerification({ userId, secret }).then(() => true, () => false);
  return NextResponse.redirect(`${APP_URL}/email-confirmado?ok=${ok ? 1 : 0}`, 303);
}
