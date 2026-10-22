// GET /api/workspace/files — todos los archivos del workspace con la ruta de su carpeta. Solo
// incluye los de carpetas a las que el usuario puede entrar (las restringidas ajenas no cuentan).
import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { listAll } from "@/lib/appwrite.js";
import { getWorkspaceContext, listFolders } from "@/lib/workspace.js";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const folders = await listFolders(context);
  const byId = new Map(folders.map((folder) => [folder.$id, folder]));
  // Ruta "Padre / Hija"; solo recorre carpetas accesibles y corta si hubiera un ciclo.
  const pathOf = (folder) => {
    const names = [];
    for (let current = folder, steps = 0; current && steps < 20; current = byId.get(current.parentId), steps++) names.unshift(current.name);
    return names.join(" / ");
  };
  const documents = await listAll(context.db, "documents", [Query.equal("workspaceId", context.workspace.$id), Query.orderDesc("$createdAt")]);
  const files = documents
    .filter((document) => byId.has(document.folderId))
    .map((document) => ({ ...document, folderName: byId.get(document.folderId).name, folderPath: pathOf(byId.get(document.folderId)), downloadUrl: `/api/workspace/folders/${document.folderId}/files/${document.$id}` }));
  return NextResponse.json({ files });
}
