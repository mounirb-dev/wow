// PATCH /api/workspace/folders/:id — renombra o mueve una carpeta (editor+); impide moverla dentro de sí misma.
// También cambia el acceso (`restricted` + `allowedUserIds`), solo owner/admin o quien creó la carpeta.
import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { DB, listAll } from "@/lib/appwrite.js";
import { revalidateFoldersCache } from "@/lib/cache-tags.js";
import { canConfigureAccess, sanitizeAllowedUserIds } from "@/lib/folder-access.js";
import { canEdit, getFolder, getWorkspaceContext } from "@/lib/workspace.js";

export async function PATCH(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "No tienes permiso para editar carpetas" }, { status: 403 });
  const [{ id }, body] = await Promise.all([params, request.json()]);
  // getFolder lanza code 404 tanto si no existe como si es de otro workspace.
  const lookup = (folderId) => getFolder(context, folderId).catch((error) => { if (error.code === 404) return null; throw error; });
  const folder = await lookup(id);
  if (!folder) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
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
      const parent = await lookup(parentId);
      if (!parent) return NextResponse.json({ error: "Carpeta padre no válida" }, { status: 400 });
      if (parent.parentId === id) return NextResponse.json({ error: "No puedes crear un ciclo de carpetas" }, { status: 400 });
    }
    data.parentId = parentId;
  }
  if (body.description !== undefined) data.description = String(body.description ?? "").trim() || null;
  if (body.restricted !== undefined || body.allowedUserIds !== undefined) {
    if (!canConfigureAccess(context.member, folder)) return NextResponse.json({ error: "Solo un administrador o quien creó la carpeta puede cambiar su acceso" }, { status: 403 });
    const members = await listAll(context.db, "workspace_members", [Query.equal("workspaceId", context.workspace.$id)]);
    const allowedUserIds = sanitizeAllowedUserIds(body.allowedUserIds ?? folder.allowedUserIds ?? [], members);
    if (!allowedUserIds) return NextResponse.json({ error: "La lista de usuarios no es válida" }, { status: 400 });
    data.restricted = body.restricted === undefined ? Boolean(folder.restricted) : body.restricted === true;
    data.allowedUserIds = allowedUserIds;
  }
  if (!Object.keys(data).length) return NextResponse.json({ folder });
  const updated = await context.db.updateRow(DB, "folders", id, data);
  revalidateFoldersCache();
  return NextResponse.json({ folder: updated });
}
