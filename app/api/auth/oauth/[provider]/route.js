import { NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { adminClient, APP_URL } from "@/lib/appwrite.js";

export async function GET(_req, { params }) {
  const { provider } = await params;
  if (provider !== "google") return new NextResponse("Provider not supported", { status: 404 });
  try {
    const url = await new Account(adminClient()).createOAuth2Token({
      provider,
      success: `${APP_URL}/api/auth/callback`,
      failure: `${APP_URL}/login?error=oauth`,
    });
    return NextResponse.redirect(url);
  } catch (e) {
    // Appwrite answers 412 when the provider has no credentials yet; the SDK surfaces it as a vague message.
    const msg = "Google no está configurado todavía: añade GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env.local y ejecuta `bun run appwrite:configure`.";
    console.error("oauth start failed:", e.message);
    return NextResponse.redirect(`${APP_URL}/login?error=${encodeURIComponent(msg)}`);
  }
}
