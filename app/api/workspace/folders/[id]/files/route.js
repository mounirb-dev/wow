// /api/workspace/folders/:id/files — GET lista los archivos; POST abre una subida (editor+).
// La subida va por partes (ver lib/upload-limits.js): POST valida el archivo y devuelve un token
// firmado; las partes y el cierre van a ./upload (ver upload/route.js).
import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { DB } from "@/lib/appwrite.js";
import { publicFile } from "@/lib/document-files.js";
import { PART_SIZE, maxUploadBytes, partCount } from "@/lib/upload-limits.js";
import { signUpload } from "@/lib/upload-token.js";
import { canEdit, findFolder, getWorkspaceContext } from "@/lib/workspace.js";

// Nombre de archivo seguro: sin separadores de ruta ni caracteres de control, <= 255.
const cleanName = (value) => String(value ?? "").toWellFormed().replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 255);
// Tipo MIME declarado por el navegador; si no tiene forma de tipo, octet-stream. Solo es una pista.
const cleanType = (value) => (/^[\w.+-]+\/[\w.+-]+$/.test(String(value ?? "")) ? String(value).slice(0, 127) : "application/octet-stream");

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
  return NextResponse.json({ files: rows.map((file) => publicFile(folderId, file)) });
}

export async function POST(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "Tu rol solo permite consultar" }, { status: 403 });
  const { id: folderId } = await params;
  if (!(await findFolder(context, folderId))) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = cleanName(body.name);
  const size = Number(body.size);
  if (!name) return NextResponse.json({ error: "Falta el nombre del archivo" }, { status: 400 });
  if (!Number.isInteger(size) || size < 1) return NextResponse.json({ error: "El archivo está vacío o su tamaño no es válido" }, { status: 400 });
  const limit = maxUploadBytes();
  if (size > limit) return NextResponse.json({ error: `El archivo supera el límite de ${Math.round(limit / 1024 / 1024)} MB` }, { status: 413 });

  const token = signUpload({ d: ID.unique(), f: folderId, u: context.user.$id, w: context.workspace.$id, n: name, s: size, t: cleanType(body.type) });
  return NextResponse.json({ token, partSize: PART_SIZE, parts: partCount(size) }, { status: 201 });
}
