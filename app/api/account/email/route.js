// POST /api/account/email — cambia el email de la cuenta de quien tiene la sesión iniciada.
// Appwrite exige la contraseña actual (por eso una cuenta que solo entra con Google no puede usarlo).
// Tras cambiarlo, el email de sus membresías se actualiza para que la lista de miembros no muestre el viejo.
import { NextResponse } from "next/server";
import { Account, Query, TablesDB } from "node-appwrite";
import { adminClient, DB, sessionClient } from "@/lib/appwrite.js";
import { sendEmailVerification } from "@/lib/email-verification.js";
import { COOKIE } from "@/lib/session.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fail = (error, status) => NextResponse.json({ error }, { status });

export async function POST(req) {
  const secret = req.cookies.get(COOKIE)?.value;
  if (!secret) return fail("Inicia sesión para cambiar tu email", 401);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!EMAIL.test(email) || email.length > 255) return fail("Introduce un email válido", 400);
  if (!password) return fail("Escribe tu contraseña actual para confirmar el cambio", 400);

  let user;
  try {
    user = await new Account(sessionClient(secret)).updateEmail({ email, password });
  } catch (error) {
    if (error?.code === 409) return fail("Ya existe una cuenta con ese email", 409);
    if (error?.code === 401) return fail("La contraseña no es correcta o la sesión ha caducado", 401);
    if (error?.code === 400) return fail("No se pudo cambiar: revisa el email y la contraseña", 400);
    return fail("No se pudo cambiar el email. Inténtalo de nuevo", 500);
  }

  // Solo cosmético (la pertenencia al workspace va por userId): si falla, el cambio de email ya está hecho.
  try {
    const db = new TablesDB(adminClient());
    const { rows } = await db.listRows(DB, "workspace_members", [Query.equal("userId", user.$id), Query.limit(20)]);
    await Promise.all(rows.map((row) => db.updateRow(DB, "workspace_members", row.$id, { email })));
  } catch { /* se queda el email anterior en la lista de miembros */ }

  // El email nuevo queda sin verificar hasta que abra el enlace que se le manda (ver ./verify).
  const verificationSent = await sendEmailVerification(secret).then(() => true, () => false);
  return NextResponse.json({ email: user.email, verificationSent });
}
