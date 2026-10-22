import { InputFile } from "node-appwrite/file";
import { BUCKET_ID, adminStorage } from "./appwrite.js";

// Sube bytes al bucket. El SDK de Appwrite solo envía como archivo un `File` o un `InputFile`: un
// Buffer suelto se manda como un campo cualquiera y el servidor lo rechaza. `filename` aporta la
// extensión que valida el bucket (png, jpg, pdf…).
export const uploadFile = (fileId, bytes, filename) => adminStorage().createFile(BUCKET_ID, fileId, InputFile.fromBuffer(bytes, filename), []);

export const deleteFile = (fileId) => adminStorage().deleteFile(BUCKET_ID, fileId);

// Bytes de un archivo de Storage. NO se usa getFileDownload del SDK: Appwrite responde con
// `Content-Type: application/json` a cualquier archivo cuyo contenido parezca JSON (un .json, un
// descriptor…) y el SDK, al ver ese tipo, devuelve el objeto ya interpretado en vez de los bytes. Aquí
// se leen siempre como bytes. Lanza un error con `code` = estado HTTP (404 si ya no existe).
export async function downloadFile(fileId) {
  const url = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${encodeURIComponent(BUCKET_ID)}/files/${encodeURIComponent(fileId)}/download`;
  const response = await fetch(url, { cache: "no-store", headers: { "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID, "X-Appwrite-Key": process.env.APPWRITE_API_KEY } });
  if (!response.ok) throw Object.assign(new Error(`Storage respondió ${response.status}`), { code: response.status });
  return Buffer.from(await response.arrayBuffer());
}
