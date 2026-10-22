// GET /api/auth/oauth/google — inicia el login con Google. Genera un `state` aleatorio, lo guarda
// en cookie y redirige a Google. Los fallos suelen ser Google sin credenciales en Appwrite.
// Appwrite guarda las credenciales y los tokens de OAuth; aquí no se guarda ninguno.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Account } from "node-appwrite";
import { adminClient } from "@/lib/appwrite.js";
import { safeNext } from "@/lib/safe-next.js";

export async function GET(req) {
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const appUrl = new URL(req.url).origin;
  const state = randomUUID();
  try {
    const url = await new Account(adminClient()).createOAuth2Token({
      provider: "google",
      success: `${appUrl}/api/auth/callback?next=${encodeURIComponent(next)}`,
      failure: `${appUrl}/login?error=oauth`,
      state,
    });
    const response = NextResponse.redirect(url);
    response.cookies.set("as_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    response.cookies.set("as_oauth_next", next, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    return response;
  } catch (e) {
    // Appwrite answers 412 when the provider has no credentials yet; the SDK surfaces it as a vague message.
    console.error("oauth start failed:", e.message);
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent("Google no está configurado todavía en Appwrite.")}`);
  }
}
