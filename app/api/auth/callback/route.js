// GET /api/auth/callback — destino del login social (Google/Apple). Appwrite devuelve
// userId+secret; los canjeamos por una sesión. `state` (cookie vs query) evita CSRF y `next`
// solo admite rutas internas (empiezan por "/" y no por "//") para no permitir open-redirects.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Account } from "node-appwrite";
import { adminClient } from "@/lib/appwrite.js";
import { COOKIE, cookieOptions } from "@/lib/session.js";

export async function GET(req) {
  const appUrl = new URL(req.url).origin;
  const q = new URL(req.url).searchParams;
  const stateCookie = (await cookies()).get("as_oauth_state")?.value;
  const state = q.get("state");
  const nextCookie = (await cookies()).get("as_oauth_next")?.value;
  const nextParam = q.get("next");
  const next = (nextCookie && nextCookie.startsWith("/") && !nextCookie.startsWith("//"))
    ? nextCookie
    : (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/");
  if (!stateCookie || !state || stateCookie !== state) return NextResponse.redirect(`${appUrl}/login?error=oauth_state`);
  try {
    const session = await new Account(adminClient()).createSession({ userId: q.get("userId"), secret: q.get("secret") });
    const res = NextResponse.redirect(`${appUrl}${next}`);
    res.cookies.set(COOKIE, session.secret, cookieOptions);
    res.cookies.delete("as_oauth_state");
    res.cookies.delete("as_oauth_next");
    return res;
  } catch (e) {
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(e.message)}`);
  }
}
