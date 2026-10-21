// POST /api/mcp/oauth/token — canje de código (con PKCE) o refresh token por tokens de acceso.
import { exchange } from "@/lib/mcp-oauth.js";

const noStore = { "cache-control": "no-store", pragma: "no-cache" };

export async function POST(request) {
  const form = Object.fromEntries(new URLSearchParams(await request.text()));
  const { tokens, error } = exchange(form);
  return error ? Response.json({ error }, { status: 400, headers: noStore }) : Response.json(tokens, { headers: noStore });
}
