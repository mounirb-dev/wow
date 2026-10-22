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
    // Appwrite answers 412 when Google is disabled or has no credentials in the project, and 400 when the
    // redirect host is not a registered platform; the SDK surfaces both as the same vague "Invalid redirect".
    console.error("oauth start failed:", e.code, e.message);
    const msg = e.code === 412
      ? "Google no está activado en este proyecto de Appwrite: activa Google en Auth → Ajustes con su ID de cliente y secreto."
      : e.code === 400
        ? `Appwrite no acepta ${appUrl} como plataforma: añádela en Resumen → Plataformas (ejecuta bun run appwrite:configure).`
        : "No se pudo iniciar el login con Google.";
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`);
  }
}
