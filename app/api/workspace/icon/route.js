// /api/workspace/icon — icono del workspace en Appwrite Storage.
//  POST: sube una imagen (PNG, JPG o WebP, <=2 MB, owner/admin) y borra la anterior.
//  GET: sirve una miniatura 96×96. Va por esta ruta (no URL directa del bucket) para respetar
//  la pertenencia al workspace.
import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { BUCKET_ID, DB, adminStorage } from "@/lib/appwrite.js";
import { deleteFile, uploadFile } from "@/lib/storage.js";
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

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context?.workspace.iconFileId) return new NextResponse(null, { status: 404 });
  const content = await adminStorage().getFilePreview(BUCKET_ID, context.workspace.iconFileId, 96, 96);
  return new NextResponse(content, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" } });
}
