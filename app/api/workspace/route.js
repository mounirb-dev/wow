import { NextResponse } from "next/server";
import { DB } from "@/lib/appwrite.js";
import { canManage, getWorkspaceContext } from "@/lib/workspace.js";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ workspace: context.workspace, member: context.member });
}

export async function PATCH(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "Solo un administrador puede cambiar el nombre" }, { status: 403 });
  const { name } = await request.json();
  const cleanName = String(name ?? "").trim();
  if (!cleanName || cleanName.length > 160) return NextResponse.json({ error: "El nombre no es válido" }, { status: 400 });
  const workspace = await context.db.updateRow(DB, "workspaces", context.workspace.$id, { name: cleanName });
  return NextResponse.json({ workspace });
}
