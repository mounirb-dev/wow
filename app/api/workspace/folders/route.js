import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { DB } from "@/lib/appwrite.js";
import { revalidateFoldersCache } from "@/lib/cache-tags.js";
import { canEdit, getWorkspaceContext, listFolders, WORKSPACE_ID } from "@/lib/workspace.js";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ folders: await listFolders() });
}

export async function POST(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "No tienes permiso para crear carpetas" }, { status: 403 });
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const parentId = body.parentId ? String(body.parentId) : null;
  if (!name || name.length > 160) return NextResponse.json({ error: "El nombre no es válido" }, { status: 400 });
  if (parentId) {
    const parent = await context.db.getRow(DB, "folders", parentId);
    if (parent.workspaceId !== WORKSPACE_ID) return NextResponse.json({ error: "Carpeta padre no válida" }, { status: 400 });
  }
  const folder = await context.db.createRow(DB, "folders", ID.unique(), { workspaceId: WORKSPACE_ID, parentId, name, description: String(body.description ?? "").trim() || null, kind: "custom", createdBy: context.user.$id });
  revalidateFoldersCache();
  return NextResponse.json({ folder }, { status: 201 });
}
