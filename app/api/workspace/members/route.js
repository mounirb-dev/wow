// /api/workspace/members — GET lista miembros; POST invita por email (solo owner/admin).
// Si el email ya tiene una cuenta verificada, entra activo; si no, queda como "invited" y se activa en
// su primer acceso con el email verificado (ver getWorkspaceContext); en ese caso se le manda un email con
// el enlace para crear su cuenta (lib/onboarding.js).
import { NextResponse } from "next/server";
import { ID, Query, Users } from "node-appwrite";
import { adminClient, DB } from "@/lib/appwrite.js";
import { sendOnboardingEmail } from "@/lib/onboarding.js";
import { canManage, getWorkspaceContext, normalizeRole, workspaceMemberId } from "@/lib/workspace.js";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { rows } = await context.db.listRows(DB, "workspace_members", [Query.equal("workspaceId", context.workspace.$id), Query.orderAsc("name"), Query.limit(200)]);
  // `viewerId`: la fila del propio usuario, para que la interfaz no ofrezca quitarse a sí mismo.
  return NextResponse.json({ members: rows, viewerId: context.member.$id });
}

export async function POST(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "Solo un administrador puede invitar miembros" }, { status: 403 });
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Introduce un email válido" }, { status: 400 });
  if (body.role === "owner") return NextResponse.json({ error: "El rol de propietario no se puede asignar" }, { status: 400 });
  const users = await context.db.listRows(DB, "workspace_members", [Query.equal("workspaceId", context.workspace.$id), Query.equal("email", email), Query.limit(1)]);
  if (users.total) return NextResponse.json({ error: "Ese usuario ya está en el workspace" }, { status: 409 });
  let userId = `invite_${ID.unique()}`;
  let name = email;
  try {
    const found = await new Users(adminClient()).list([Query.equal("email", email), Query.limit(1)]);
    // Solo una cuenta con el email verificado entra activa: una sin verificar pudo crearla cualquiera con ese email.
    if (found.users[0]?.emailVerification) { userId = found.users[0].$id; name = found.users[0].name || email; }
  } catch { /* La invitación pendiente también es válida para usuarios aún no registrados. */ }
  const member = await context.db.createRow(DB, "workspace_members", workspaceMemberId(context.workspace.$id, userId), { workspaceId: context.workspace.$id, userId, email, name, role: normalizeRole(body.role), status: userId.startsWith("invite_") ? "invited" : "active" });
  // Quien aún no puede entrar (sin cuenta o con el email sin verificar) recibe un email para crear su cuenta.
  // Si el email no sale, la invitación sigue creada y se avisa: se puede reenviar desde /onboarding.
  let emailSent = null;
  if (member.status === "invited") {
    try { await sendOnboardingEmail(email); emailSent = true; }
    catch (error) { emailSent = false; console.error("onboarding email failed:", error.code, error.message); }
  }
  return NextResponse.json({ member, emailSent }, { status: 201 });
}
