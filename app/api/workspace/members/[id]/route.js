// PATCH (cambiar rol) / DELETE (expulsar) de un miembro, solo owner/admin. El owner no se puede
// modificar desde aquí.
import { NextResponse } from "next/server";
import { DB } from "@/lib/appwrite.js";
import { canManage, getWorkspaceContext, normalizeRole } from "@/lib/workspace.js";

export async function PATCH(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const [{ id }, body] = await Promise.all([params, request.json()]);
  const member = await context.db.getRow(DB, "workspace_members", id);
  if (member.workspaceId !== context.workspace.$id) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  if (member.role === "owner") return NextResponse.json({ error: "El propietario no puede cambiarse desde aquí" }, { status: 400 });
  return NextResponse.json({ member: await context.db.updateRow(DB, "workspace_members", id, { role: normalizeRole(body.role) }) });
}

export async function DELETE(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const member = await context.db.getRow(DB, "workspace_members", id);
  if (member.workspaceId !== context.workspace.$id) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  if (member.role === "owner") return NextResponse.json({ error: "El propietario no puede eliminarse" }, { status: 400 });
  await context.db.deleteRow(DB, "workspace_members", id);
  return NextResponse.json({ ok: true });
}
