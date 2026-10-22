// /api/workspace/folders/:id/files/upload — partes y cierre de una subida abierta con POST ../files.
//   PUT    ?part=N  cuerpo = bytes de la parte N (<= 4 MB). Se guarda como un archivo de Storage.
//   POST            cierra la subida: comprueba que están TODAS las partes y crea el documento.
//   DELETE          cancela: borra las partes subidas.
// El token firmado (cabecera x-upload-token) lleva lo validado al abrir; aquí solo se comprueba que
// sigue siendo del mismo usuario, workspace y carpeta, y que ese usuario sigue pudiendo escribir.
import { NextResponse } from "next/server";
import { DB, BUCKET_ID, adminStorage } from "@/lib/appwrite.js";
import { mapLimit } from "@/lib/async.js";
import { publicFile } from "@/lib/document-files.js";
import { deleteFile, uploadFile } from "@/lib/storage.js";
import { partCount, partId, partLength } from "@/lib/upload-limits.js";
import { verifyUpload } from "@/lib/upload-token.js";
import { canEdit, findFolder, getWorkspaceContext } from "@/lib/workspace.js";

const fail = (error, status) => NextResponse.json({ error }, { status });
const isMissing = (error) => error?.code === 404;

// Valida sesión, permisos y token. Devuelve { context, upload } o la respuesta de error.
async function authorize(request, params) {
  const context = await getWorkspaceContext();
  if (!context) return { response: fail("No autorizado", 401) };
  if (!canEdit(context.member)) return { response: fail("Tu rol solo permite consultar", 403) };
  const { id: folderId } = await params;
  const upload = verifyUpload(request.headers.get("x-upload-token"));
  // Un token ajeno, caducado o de otra carpeta/usuario/workspace responde igual que uno inventado.
  if (!upload || upload.f !== folderId || upload.u !== context.user.$id || upload.w !== context.workspace.$id) return { response: fail("La subida no es válida o ha caducado", 400) };
  if (!(await findFolder(context, folderId))) return { response: fail("Carpeta no encontrada", 404) };
  return { context, upload, folderId };
}

const findDocument = (context, id) => context.db.getRow(DB, "documents", id).catch((error) => { if (isMissing(error)) return null; throw error; });
const idsOf = (upload) => Array.from({ length: partCount(upload.s) }, (_, index) => partId(upload.d, index));

export async function PUT(request, { params }) {
  const auth = await authorize(request, params);
  if (auth.response) return auth.response;
  const { upload } = auth;
  const index = Number(new URL(request.url).searchParams.get("part"));
  if (!Number.isInteger(index) || index < 0 || index >= partCount(upload.s)) return fail("Parte no válida", 400);
  // Una subida ya cerrada no se puede reescribir con el mismo token: pisaría un archivo publicado.
  if (await findDocument(auth.context, upload.d)) return fail("La subida ya está completada", 409);

  // Si el cliente declara la longitud, se rechaza antes de leer el cuerpo entero a memoria.
  const expected = partLength(upload.s, index);
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) !== expected) return fail("La parte no tiene el tamaño esperado", declared !== null && Number(declared) > expected ? 413 : 400);
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length !== expected) return fail("La parte no tiene el tamaño esperado", 400);

  const id = partId(upload.d, index);
  try {
    await uploadFile(id, bytes, "parte.bin");
  } catch (error) {
    // Un reintento tras un corte: la parte ya estaba (o quedó a medias). Se rehace entera.
    if (error?.code !== 409) throw error;
    await deleteFile(id);
    await uploadFile(id, bytes, "parte.bin");
  }
  return NextResponse.json({ ok: true, part: index });
}

export async function POST(request, { params }) {
  const auth = await authorize(request, params);
  if (auth.response) return auth.response;
  const { context, upload, folderId } = auth;

  // Cerrar dos veces es inocuo: si el documento ya existe se devuelve tal cual.
  const existing = await findDocument(context, upload.d);
  if (existing) return NextResponse.json({ file: publicFile(folderId, existing) });

  const ids = idsOf(upload);
  const stored = await mapLimit(ids, 8, (id) => adminStorage().getFile(BUCKET_ID, id).catch((error) => { if (isMissing(error)) return null; throw error; }));
  const complete = stored.every((file, index) => file && file.sizeOriginal === partLength(upload.s, index));
  if (!complete) return fail("Faltan partes de la subida o están incompletas", 409);

  try {
    const document = await context.db.createRow(DB, "documents", upload.d, {
      workspaceId: context.workspace.$id,
      folderId,
      name: upload.n,
      mimeType: upload.t,
      storageFileId: ids[0],
      partIds: ids,
      size: upload.s,
      createdBy: context.user.$id,
    });
    return NextResponse.json({ file: publicFile(folderId, document) }, { status: 201 });
  } catch (error) {
    // Dos cierres a la vez: el otro ya creó el documento, que es el resultado correcto.
    if (error?.code !== 409) throw error;
    return NextResponse.json({ file: publicFile(folderId, await findDocument(context, upload.d)) });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorize(request, params);
  if (auth.response) return auth.response;
  // Si el documento ya se creó, esta ruta no lo toca: para borrar un archivo existe DELETE .../files/:fileId.
  if (await findDocument(auth.context, auth.upload.d)) return fail("La subida ya está completada", 409);
  await mapLimit(idsOf(auth.upload), 8, (id) => deleteFile(id).catch((error) => { if (!isMissing(error)) throw error; }));
  return NextResponse.json({ ok: true });
}
