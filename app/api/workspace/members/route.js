import { NextResponse } from "next/server";
import { ID, Query, Users } from "node-appwrite";
import { adminClient, DB } from "@/lib/appwrite.js";
import { canManage, getWorkspaceContext, normalizeRole } from "@/lib/workspace.js";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { rows } = await context.db.listRows(DB, "workspace_members", [Query.equal("workspaceId", context.workspace.$id), Query.orderAsc("name"), Query.limit(200)]);
  return NextResponse.json({ members: rows });
}

export async function POST(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "Solo un administrador puede invitar miembros" }, { status: 403 });
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Introduce un email válido" }, { status: 400 });
  const users = await context.db.listRows(DB, "workspace_members", [Query.equal("workspaceId", context.workspace.$id), Query.equal("email", email), Query.limit(1)]);
  if (users.total) return NextResponse.json({ error: "Ese usuario ya está en el workspace" }, { status: 409 });
  let userId = `invite_${ID.unique()}`;
  let name = email;
  try {
    const found = await new Users(adminClient()).list([Query.equal("email", email), Query.limit(1)]);
    if (found.users[0]) { userId = found.users[0].$id; name = found.users[0].name || email; }
  } catch { /* La invitación pendiente también es válida para usuarios aún no registrados. */ }
  const member = await context.db.createRow(DB, "workspace_members", `${context.workspace.$id}_${userId}`, { workspaceId: context.workspace.$id, userId, email, name, role: normalizeRole(body.role), status: userId.startsWith("invite_") ? "invited" : "active" });
  return NextResponse.json({ member }, { status: 201 });
}
