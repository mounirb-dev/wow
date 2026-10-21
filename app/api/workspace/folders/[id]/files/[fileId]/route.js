// GET descarga / DELETE borra un archivo. Comprueba que pertenece al workspace Y a esa carpeta
// antes de tocar el almacenamiento.
import { NextResponse } from "next/server";
import { BUCKET_ID, DB, adminStorage } from "@/lib/appwrite.js";
import { canEdit, getWorkspaceContext } from "@/lib/workspace.js";

async function getDocument(context, folderId, fileId) {
  try {
    const document = await context.db.getRow(DB, "documents", fileId);
    return document.workspaceId === context.workspace.$id && document.folderId === folderId ? document : null;
  } catch (error) {
    if (error.code === 404) return null;
    throw error;
  }
}

export async function GET(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: folderId, fileId } = await params;
  const document = await getDocument(context, folderId, fileId);
  if (!document) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

  const content = await adminStorage().getFileDownload(BUCKET_ID, document.storageFileId);
  return new NextResponse(content, { headers: { "Content-Type": document.mimeType || "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}` } });
}

export async function DELETE(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "Tu rol solo permite consultar" }, { status: 403 });
  const { id: folderId, fileId } = await params;
  const document = await getDocument(context, folderId, fileId);
  if (!document) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

  await adminStorage().deleteFile(BUCKET_ID, document.storageFileId);
  await context.db.deleteRow(DB, "documents", fileId);
  return new NextResponse(null, { status: 204 });
}
