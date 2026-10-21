// PATCH /api/workspace/folders/:id — renombra o mueve una carpeta (editor+); impide moverla dentro de sí misma.
import { NextResponse } from "next/server";
import { DB } from "@/lib/appwrite.js";
import { revalidateFoldersCache } from "@/lib/cache-tags.js";
import { canEdit, getFolder, getWorkspaceContext } from "@/lib/workspace.js";

export async function PATCH(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "No tienes permiso para editar carpetas" }, { status: 403 });
  const { id } = await params;
  const folder = await getFolder(context, id);
  const body = await request.json();
  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 160) return NextResponse.json({ error: "El nombre no es válido" }, { status: 400 });
    data.name = name;
  }
  if (body.parentId !== undefined) {
    const parentId = body.parentId ? String(body.parentId) : null;
    if (parentId === id) return NextResponse.json({ error: "Una carpeta no puede contenerse a sí misma" }, { status: 400 });
    if (parentId) {
      const parent = await getFolder(context, parentId);
      if (parent.parentId === id) return NextResponse.json({ error: "No puedes crear un ciclo de carpetas" }, { status: 400 });
    }
    data.parentId = parentId;
  }
  if (body.description !== undefined) data.description = String(body.description ?? "").trim() || null;
  if (!Object.keys(data).length) return NextResponse.json({ folder });
  const updated = await context.db.updateRow(DB, "folders", id, data);
  revalidateFoldersCache();
  return NextResponse.json({ folder: updated });
}
