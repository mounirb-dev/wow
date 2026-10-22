// POST /api/auth/logout — cierra la sesión en Appwrite, borra la cookie y vuelve al login.
import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { APP_URL, sessionClient } from "@/lib/appwrite.js";
import { COOKIE } from "@/lib/session.js";

export async function POST(req) {
  const secret = req.cookies.get(COOKIE)?.value;
  // Si Appwrite ya la había cerrado o caducado, da igual: lo importante es que el navegador la olvide.
  if (secret) await new Account(sessionClient(secret)).deleteSession({ sessionId: "current" }).catch(() => {});
  const res = NextResponse.redirect(`${APP_URL}/login`, 303);
  res.cookies.delete(COOKIE);
  return res;
}
