// /api/workspace/folders/:id/files — GET lista los archivos; POST sube uno (<=25 MB, editor+).
// El binario va a Appwrite Storage y los metadatos a la tabla `documents`; si falla el segundo
// paso se borra el binario para no dejar archivos huérfanos.
import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { DB } from "@/lib/appwrite.js";
import { deleteFile, uploadFile } from "@/lib/storage.js";
import { canEdit, findFolder, getWorkspaceContext } from "@/lib/workspace.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function GET(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: folderId } = await params;
  if (!(await findFolder(context, folderId))) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });

  const { rows } = await context.db.listRows(DB, "documents", [
    Query.equal("workspaceId", context.workspace.$id),
    Query.equal("folderId", folderId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return NextResponse.json({ files: rows.map((file) => ({ ...file, downloadUrl: `/api/workspace/folders/${folderId}/files/${file.$id}` })) });
}

export async function POST(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "Tu rol solo permite consultar" }, { status: 403 });
  const { id: folderId } = await params;
  if (!(await findFolder(context, folderId))) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "El archivo supera el límite de 25 MB" }, { status: 413 });

  const storageFileId = ID.unique();
  try {
    await uploadFile(storageFileId, Buffer.from(await file.arrayBuffer()), file.name);
    const document = await context.db.createRow(DB, "documents", ID.unique(), {
      workspaceId: context.workspace.$id,
      folderId,
      name: file.name.slice(0, 255),
      mimeType: file.type || "application/octet-stream",
      storageFileId,
      createdBy: context.user.$id,
    });
    return NextResponse.json({ file: { ...document, downloadUrl: `/api/workspace/folders/${folderId}/files/${document.$id}` } }, { status: 201 });
  } catch (error) {
    try { await deleteFile(storageFileId); } catch { /* Keep the original error. */ }
    console.error("workspace file upload failed", error);
    return NextResponse.json({ error: "No se pudo guardar el archivo" }, { status: 500 });
  }
}
