// POST /api/auth/onboarding/resend — pide otro enlace de onboarding (el de Appwrite caduca a la hora). Solo lo
// manda si ese email tiene una invitación pendiente, pero la respuesta es siempre la misma para no revelar
// qué emails están invitados.
import { NextResponse } from "next/server";
import { Query, TablesDB } from "node-appwrite";
import { adminClient, APP_URL, DB } from "@/lib/appwrite.js";
import { sendOnboardingEmail } from "@/lib/onboarding.js";

export async function POST(req) {
  const email = String((await req.formData()).get("email") ?? "").trim().toLowerCase();
  if (/^\S+@\S+\.\S+$/.test(email)) {
    try {
      const { rows } = await new TablesDB(adminClient()).listRows(DB, "workspace_members", [Query.equal("email", email), Query.equal("status", "invited"), Query.limit(1)]);
      if (rows[0]) await sendOnboardingEmail(email);
    } catch (error) {
      console.error("onboarding resend failed:", error.code, error.message);
    }
  }
  return NextResponse.redirect(`${APP_URL}/onboarding?sent=1`, 303);
}
