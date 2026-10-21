import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { BUCKET_ID, DB, adminStorage } from "@/lib/appwrite.js";
import { canManage, getWorkspaceContext } from "@/lib/workspace.js";

const MAX_ICON_SIZE = 2 * 1024 * 1024;

export async function POST(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "Solo un administrador puede cambiar el icono" }, { status: 403 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_ICON_SIZE) return NextResponse.json({ error: "Elige una imagen de máximo 2 MB" }, { status: 400 });
  const fileId = ID.unique();
  try {
    await adminStorage().createFile(BUCKET_ID, fileId, Buffer.from(await file.arrayBuffer()), []);
    if (context.workspace.iconFileId) await adminStorage().deleteFile(BUCKET_ID, context.workspace.iconFileId).catch(() => {});
    const workspace = await context.db.updateRow(DB, "workspaces", context.workspace.$id, { iconFileId: fileId });
    return NextResponse.json({ workspace, iconUrl: `/api/workspace/icon?v=${fileId}` });
  } catch (error) {
    await adminStorage().deleteFile(BUCKET_ID, fileId).catch(() => {});
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
