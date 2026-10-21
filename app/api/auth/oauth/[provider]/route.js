// GET /api/auth/oauth/:provider — inicia el login social. Genera un `state` aleatorio, lo guarda
// en cookie y redirige al proveedor. Los fallos suelen ser proveedor sin credenciales en Appwrite.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Account } from "node-appwrite";
import { adminClient } from "@/lib/appwrite.js";

const nextPath = (value) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

export async function GET(req, { params }) {
  const { provider } = await params;
  if (!["apple", "google"].includes(provider)) return new NextResponse("Provider not supported", { status: 404 });
  const next = nextPath(new URL(req.url).searchParams.get("next"));
  const appUrl = new URL(req.url).origin;
  const state = randomUUID();
  try {
    const url = await new Account(adminClient()).createOAuth2Token({
      provider,
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
    const msg = `${provider === "apple" ? "Apple" : "Google"} no está configurado todavía en Appwrite.`;
    console.error("oauth start failed:", e.message);
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`);
  }
}
