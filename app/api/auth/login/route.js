// POST /api/auth/login — email + contraseña. Crea la sesión en Appwrite y guarda su secreto en
// la cookie httpOnly. Responde con redirección 303 (formulario HTML, no fetch); el mensaje de
// error es genérico a propósito para no revelar si el email existe.
import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { adminClient, APP_URL } from "@/lib/appwrite.js";
import { safeNext } from "@/lib/safe-next.js";
import { COOKIE, cookieOptions } from "@/lib/session.js";

export async function POST(req) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));

  if (!email || !password) {
    return NextResponse.redirect(`${APP_URL}/login?error=${encodeURIComponent("Introduce tu usuario y contraseña")}&next=${encodeURIComponent(next)}`, 303);
  }

  try {
    const session = await new Account(adminClient()).createEmailPasswordSession({ email, password });
    const res = NextResponse.redirect(`${APP_URL}${next}`, 303);
    res.cookies.set(COOKIE, session.secret, cookieOptions);
    return res;
  } catch {
    return NextResponse.redirect(`${APP_URL}/login?error=${encodeURIComponent("Usuario o contraseña incorrectos")}&next=${encodeURIComponent(next)}`, 303);
  }
}
