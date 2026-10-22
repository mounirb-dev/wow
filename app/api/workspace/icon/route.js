// /api/workspace/icon — icono del workspace en Appwrite Storage.
//  POST: sube una imagen (PNG, JPG o WebP, <=2 MB, owner/admin) y borra la anterior.
//  GET: sirve el archivo del icono. Va por esta ruta (no URL directa del bucket) para respetar
//  la pertenencia al workspace.
import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { DB } from "@/lib/appwrite.js";
import { deleteFile, downloadFile, uploadFile } from "@/lib/storage.js";
import { canManage, getWorkspaceContext } from "@/lib/workspace.js";

const MAX_ICON_SIZE = 2 * 1024 * 1024;
// Solo formatos que admite el bucket (ver migración 010); el nombre del archivo lleva la extensión.
const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "Solo un administrador puede cambiar el icono" }, { status: 403 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size > MAX_ICON_SIZE || !EXTENSIONS[file.type]) return NextResponse.json({ error: "Elige una imagen PNG, JPG o WebP de máximo 2 MB" }, { status: 400 });
  const fileId = ID.unique();
  try {
    await uploadFile(fileId, Buffer.from(await file.arrayBuffer()), `icon.${EXTENSIONS[file.type]}`);
    if (context.workspace.iconFileId) await deleteFile(context.workspace.iconFileId).catch(() => {});
    const workspace = await context.db.updateRow(DB, "workspaces", context.workspace.$id, { iconFileId: fileId });
    return NextResponse.json({ workspace, iconUrl: `/api/workspace/icon?v=${fileId}` });
  } catch (error) {
    await deleteFile(fileId).catch(() => {});
    console.error("workspace icon upload failed", error);
    return NextResponse.json({ error: "No se pudo guardar el icono" }, { status: 500 });
  }
}

// Tipo de imagen por los primeros bytes (el archivo solo pudo guardarse como PNG, JPG o WebP), o null.
function sniffImage(bytes) {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

// Se sirve el archivo tal cual: NO se usa getFilePreview, porque las transformaciones de imagen están
// bloqueadas en el plan gratuito de Appwrite Cloud (403 storage_image_transformations_blocked) y el
// escudo no se veía en producción. Un icono pesa <= 2 MB y se cachea 1 h en el navegador.
export async function GET() {
  const context = await getWorkspaceContext();
  if (!context?.workspace.iconFileId) return new NextResponse(null, { status: 404 });
  let bytes;
  try { bytes = await downloadFile(context.workspace.iconFileId); }
  catch (error) {
    if (error.code === 404) return new NextResponse(null, { status: 404 });
    throw error;
  }
  const type = sniffImage(bytes);
  if (!type) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Cache-Control": "private, max-age=3600" } });
}
