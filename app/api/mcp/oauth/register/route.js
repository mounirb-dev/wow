// POST /api/mcp/oauth/register — registro dinámico de cliente (RFC 7591). Sin autenticación,
// como exige el estándar: el cliente solo recibe un client_id firmado que lleva sus redirecciones.
import { registerClient } from "@/lib/mcp-oauth.js";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { client, error } = registerClient(body);
  return error ? Response.json({ error }, { status: 400 }) : Response.json(client, { status: 201 });
}
