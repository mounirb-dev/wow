// PATCH /api/workspace/folders/:id — renombra o mueve una carpeta (editor+); impide moverla dentro de sí misma.
// También cambia el acceso (`restricted` + `allowedUserIds`), solo owner/admin o quien creó la carpeta.
// DELETE /api/workspace/folders/:id — borra la carpeta con todo su contenido (subcarpetas, archivos y
// sus binarios). Editor+ con acceso a TODA la rama: si algo dentro está restringido para el usuario, no se borra.
import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { DB, listAll } from "@/lib/appwrite.js";
import { chunk, mapLimit } from "@/lib/async.js";
import { revalidateFoldersCache } from "@/lib/cache-tags.js";
import { binaryIds } from "@/lib/document-files.js";
import { accessibleFolderIds, canConfigureAccess, descendantIds, sanitizeAllowedUserIds } from "@/lib/folder-access.js";
import { deleteFile } from "@/lib/storage.js";
import { canEdit, getFolder, getWorkspaceContext, loadAllFolders } from "@/lib/workspace.js";

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

// Un binario ya borrado (404) no impide terminar el borrado; cualquier otro fallo sí, para poder reintentar.
const dropBinary = (fileId) => deleteFile(fileId).catch((error) => { if (error.code !== 404) throw error; });

export async function DELETE(_request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "No tienes permiso para borrar carpetas" }, { status: 403 });
  const { id } = await params;
  const folder = await getFolder(context, id).catch((error) => { if (error.code === 404) return null; throw error; });
  if (!folder) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });

  const all = await loadAllFolders(context);
  const branch = [id, ...descendantIds(all, id)];
  const allowed = accessibleFolderIds(context.member, all);
  if (branch.some((folderId) => !allowed.has(folderId))) return NextResponse.json({ error: "Contiene carpetas restringidas a las que no tienes acceso" }, { status: 403 });

  // Primero los archivos (binario y fila) y al final las carpetas: si algo falla a medias, la
  // carpeta sigue existiendo y se puede reintentar sin dejar archivos huérfanos.
  const pages = await Promise.all(chunk(branch).map((ids) => listAll(context.db, "documents", [Query.equal("workspaceId", context.workspace.$id), Query.equal("folderId", ids)])));
  const documents = pages.flat();
  await mapLimit(documents, 10, async (document) => {
    await mapLimit(binaryIds(document), 8, dropBinary);
    await context.db.deleteRow(DB, "documents", document.$id);
  });
  await mapLimit(branch, 10, (folderId) => context.db.deleteRow(DB, "folders", folderId));
  revalidateFoldersCache();
  return NextResponse.json({ ok: true, folders: branch.length, files: documents.length });
}
