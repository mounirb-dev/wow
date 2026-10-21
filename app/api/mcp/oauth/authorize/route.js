// POST /api/mcp/oauth/authorize — el usuario pulsa "Autorizar" (o "Cancelar") en /mcp/oauth.
// Requiere la sesión de la web; tras re-validar cliente y redirección emite el código y vuelve
// al cliente con 303. Las peticiones inválidas nunca redirigen (evita open-redirects).
import { NextResponse } from "next/server";
import { issueCode, validateAuthorizeRequest } from "@/lib/mcp-oauth.js";
import { getUser } from "@/lib/session.js";

export async function POST(request) {
  const form = Object.fromEntries(await request.formData());
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const checked = validateAuthorizeRequest(form);
  if (checked.fatal) return NextResponse.json({ error: checked.fatal }, { status: 400 });

  const target = new URL(form.redirect_uri);
  if (form.state) target.searchParams.set("state", String(form.state));
  if (checked.error) target.searchParams.set("error", checked.error);
  else if (form.decision !== "allow") target.searchParams.set("error", "access_denied");
  else target.searchParams.set("code", issueCode({ user, clientId: form.client_id, redirectUri: form.redirect_uri, codeChallenge: form.code_challenge }));
  return NextResponse.redirect(target, 303);
}
