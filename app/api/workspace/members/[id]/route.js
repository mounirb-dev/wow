// PATCH (cambiar rol) / DELETE (quitar del workspace o cancelar una invitación) de un miembro, solo
// owner/admin. El owner no se puede modificar y nadie puede quitarse a sí mismo (no quedar sin acceso).
// Quitar a alguien no borra su cuenta de Appwrite: solo pierde el acceso (la herramienta es por invitación).
import { NextResponse } from "next/server";
import { DB } from "@/lib/appwrite.js";
import { canManage, getWorkspaceContext, normalizeRole } from "@/lib/workspace.js";

// Fila del miembro o null. "No existe" y "es de otro workspace" son indistinguibles a propósito.
async function findMember(context, id) {
  const member = await context.db.getRow(DB, "workspace_members", id).catch((error) => { if (error.code === 404) return null; throw error; });
  return member?.workspaceId === context.workspace.$id ? member : null;
}

export async function PATCH(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const [{ id }, body] = await Promise.all([params, request.json()]);
  if (body.role === "owner") return NextResponse.json({ error: "El rol de propietario no se puede asignar" }, { status: 400 });
  const member = await findMember(context, id);
  if (!member) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  if (member.role === "owner") return NextResponse.json({ error: "El propietario no puede cambiarse desde aquí" }, { status: 400 });
  return NextResponse.json({ member: await context.db.updateRow(DB, "workspace_members", id, { role: normalizeRole(body.role) }) });
}

export async function DELETE(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const member = await findMember(context, id);
  if (!member) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  if (member.role === "owner") return NextResponse.json({ error: "El propietario no puede eliminarse" }, { status: 400 });
  if (member.$id === context.member.$id) return NextResponse.json({ error: "No puedes quitarte a ti mismo" }, { status: 400 });
  await context.db.deleteRow(DB, "workspace_members", id);
  return NextResponse.json({ ok: true });
}
