// POST /api/workspace/club { name } — el workspace pasa a ser el club elegido: se renombra y, si
// se encuentra su escudo, se guarda como icono (owner/admin). Buscar el escudo es de mejor
// esfuerzo: si falla, el club se guarda igualmente y se conserva el icono anterior.
import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { DB } from "@/lib/appwrite.js";
import { findClubBadge, isBadgeUrl } from "@/lib/crest.js";
import { deleteFile, uploadFile } from "@/lib/storage.js";
import { canManage, getWorkspaceContext } from "@/lib/workspace.js";

const BADGE_ORIGIN = "https://r2.thesportsdb.com";
const MAX_BADGE_SIZE = 2 * 1024 * 1024;
const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function fetchJson(url) {
  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`TheSportsDB respondió ${response.status}`);
  return response.json();
}

// Descarga el escudo y lo guarda en Storage; devuelve el id del archivo o null.
async function storeBadge(url) {
  if (!isBadgeUrl(url)) return null;
  // Se vuelve a construir sobre el origen y la carpeta permitidos: del dato externo solo se
  // usa el nombre del archivo, y solo si es alfanumérico con extensión de imagen.
  const file = /^\/images\/media\/team\/badge\/([A-Za-z0-9]+\.(?:png|jpg|webp))$/.exec(new URL(url).pathname)?.[1];
  if (!file) return null;
  const response = await fetch(`${BADGE_ORIGIN}/images/media/team/badge/${file}`, { signal: AbortSignal.timeout(8000), redirect: "error" });
  const extension = EXTENSIONS[response.headers.get("content-type")?.split(";")[0]];
  if (!response.ok || !extension) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BADGE_SIZE) return null;
  const fileId = ID.unique();
  await uploadFile(fileId, bytes, `club.${extension}`);
  return fileId;
}

export async function POST(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManage(context.member)) return NextResponse.json({ error: "Solo un administrador puede cambiar el club" }, { status: 403 });
  const name = String((await request.json().catch(() => ({}))).name ?? "").trim();
  if (!name || name.length > 160) return NextResponse.json({ error: "El nombre no es válido" }, { status: 400 });

  let iconFileId = null;
  try { iconFileId = await storeBadge(await findClubBadge(name, fetchJson)); }
  catch (error) { console.error("club badge lookup failed", error); }

  try {
    const workspace = await context.db.updateRow(DB, "workspaces", context.workspace.$id, { name, ...(iconFileId && { iconFileId }) });
    if (iconFileId && context.workspace.iconFileId) await deleteFile(context.workspace.iconFileId).catch(() => {});
    return NextResponse.json({ workspace, crest: Boolean(iconFileId), iconUrl: iconFileId ? `/api/workspace/icon?v=${iconFileId}` : null });
  } catch (error) {
    if (iconFileId) await deleteFile(iconFileId).catch(() => {});
    throw error;
  }
}
