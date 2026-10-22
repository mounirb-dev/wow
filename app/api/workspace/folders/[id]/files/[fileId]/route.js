// GET descarga o muestra un archivo / DELETE lo borra. Comprueba que pertenece al workspace Y a esa
// carpeta antes de tocar el almacenamiento.
// GET admite Range (para adelantar un vídeo sin bajarlo entero) y ?inline=1 para mostrar fotos,
// vídeos y audio dentro de la página; todo lo demás se sirve siempre como descarga.
import { NextResponse } from "next/server";
import { DB } from "@/lib/appwrite.js";
import { mapLimit } from "@/lib/async.js";
import { binaryIds, parseRange, streamParts } from "@/lib/document-files.js";
import { inlineMime } from "@/lib/files.js";
import { deleteFile, downloadFile } from "@/lib/storage.js";
import { canEdit, findFolder, getWorkspaceContext } from "@/lib/workspace.js";

async function getDocument(context, folderId, fileId) {
  // Sin acceso a la carpeta (restringida) tampoco hay acceso a sus archivos.
  if (!(await findFolder(context, folderId))) return null;
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

  // Solo se muestra inline un tipo de la lista (fotos, vídeo, audio); con nosniff el navegador no lo
  // reinterpreta como otra cosa y con sandbox nunca ejecuta nada en nuestro origen.
  const inline = new URL(request.url).searchParams.get("inline") === "1" ? inlineMime(document) : null;
  const filename = encodeURIComponent(document.name);
  const headers = {
    "Content-Type": inline ?? (document.mimeType || "application/octet-stream"),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    ...(inline && { "Content-Security-Policy": "sandbox" }),
  };

  // Archivos anteriores a las subidas por partes: un único binario (<= 25 MB), leído entero.
  const single = document.partIds?.length ? null : await downloadFile(document.storageFileId);
  const size = single ? single.length : document.size;
  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = single ? new Uint8Array(single.subarray(start, end + 1)) : streamParts(document, start, end, downloadFile);
  return new NextResponse(body, {
    status: range ? 206 : 200,
    headers: { ...headers, "Content-Length": String(end - start + 1), ...(range && { "Content-Range": `bytes ${start}-${end}/${size}` }) },
  });
}

export async function DELETE(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "Tu rol solo permite consultar" }, { status: 403 });
  const { id: folderId, fileId } = await params;
  const document = await getDocument(context, folderId, fileId);
  if (!document) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

  // Primero los binarios (todas las partes) y al final la fila: si algo falla se puede reintentar.
  await mapLimit(binaryIds(document), 8, (id) => deleteFile(id).catch((error) => { if (error.code !== 404) throw error; }));
  await context.db.deleteRow(DB, "documents", fileId);
  return new NextResponse(null, { status: 204 });
}
