// POST /api/auth/onboarding — la persona invitada abre el enlace del email (/onboarding?userId&secret), escribe
// su nombre y una contraseña y entra. Canjea el secreto por una sesión (el enlace solo vale una vez), guarda
// nombre y contraseña en su cuenta de Appwrite y deja la cookie de sesión. La invitación al workspace se
// activa sola en la primera petición (el enlace ya verificó su email). Ver lib/onboarding.js.
import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { adminClient, APP_URL, sessionClient } from "@/lib/appwrite.js";
import { validateOnboarding } from "@/lib/onboarding.js";
import { COOKIE, cookieOptions } from "@/lib/session.js";

const back = (params, error) => NextResponse.redirect(`${APP_URL}/onboarding?${new URLSearchParams({ ...params, error })}`, 303);

export async function POST(req) {
  const form = await req.formData();
  const userId = String(form.get("userId") ?? "");
  const secret = String(form.get("secret") ?? "");
  if (!userId || !secret) return back({}, "link");

  const invalid = validateOnboarding({ name: form.get("name"), password: form.get("password"), confirm: form.get("confirm") });
  if (invalid) return back({ userId, secret }, invalid);

  let session;
  try {
    session = await new Account(adminClient()).createSession({ userId, secret });
  } catch {
    return back({}, "link");
  }

  try {
    const account = new Account(sessionClient(session.secret));
    await account.updateName({ name: String(form.get("name")).trim() });
    await account.updatePassword({ password: String(form.get("password")) });
  } catch {
    // El enlace ya se gastó y hay sesión: se entra igualmente; la contraseña se puede fijar con «¿Has olvidado tu contraseña?».
  }
  const res = NextResponse.redirect(`${APP_URL}/`, 303);
  res.cookies.set(COOKIE, session.secret, cookieOptions);
  return res;
}
