"use client";

import { request } from "./api-client.js";
import { partLength } from "./upload-limits.js";

const JSON_HEADERS = { "content-type": "application/json" };
const PARALLEL_PARTS = 3;
const ATTEMPTS = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Solo merece la pena reintentar un fallo de red o un 5xx; un 4xx (sin permiso, tamaño mal, token
// caducado) no se arregla repitiéndolo.
const retryable = (error) => !error.status || error.status >= 500;

// Sube UNA parte con reintentos (un corte de red a mitad de un vídeo no debe obligar a empezar de cero).
async function sendPart(url, token, blob, attempt = 1) {
  try {
    return await request(url, { method: "PUT", headers: { "x-upload-token": token, "content-type": "application/octet-stream" }, body: blob });
  } catch (error) {
    if (attempt >= ATTEMPTS || !retryable(error)) throw error;
    await sleep(500 * attempt);
    return sendPart(url, token, blob, attempt + 1);
  }
}

// Sube un archivo (foto, vídeo, lo que sea) a una carpeta: abre la subida, envía las partes de 4 MB
// de a pocas a la vez, y la cierra. Si algo falla, espera a que terminen las partes que iban en
// vuelo, cancela (para no dejar partes huérfanas) y lanza el primer error.
// `onProgress(bytesSubidos)` se llama a medida que avanzan las partes. Devuelve el documento creado.
export async function uploadFile(folderId, file, onProgress = () => {}) {
  const base = `/api/workspace/folders/${encodeURIComponent(folderId)}/files`;
  const { token, partSize, parts } = await request(base, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name: file.name, size: file.size, type: file.type }) });
  let sent = 0;
  let next = 0;
  let failure = null;

  // Cada trabajador toma la siguiente parte cuando termina la anterior. Nunca rechaza: así, al acabar
  // el Promise.all, ya no queda ninguna parte en vuelo que pueda escribirse después de cancelar.
  const worker = async () => {
    const index = next;
    next += 1;
    if (index >= parts || failure) return;
    try {
      await sendPart(`${base}/upload?part=${index}`, token, file.slice(index * partSize, index * partSize + partLength(file.size, index)));
      sent += partLength(file.size, index);
      onProgress(sent);
    } catch (error) {
      failure ??= error;
      return;
    }
    await worker();
  };

  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, parts) }, worker));
    if (failure) throw failure;
    return (await request(`${base}/upload`, { method: "POST", headers: { "x-upload-token": token } })).file;
  } catch (error) {
    await fetch(`${base}/upload`, { method: "DELETE", credentials: "include", headers: { "x-upload-token": token } }).catch(() => {});
    throw error;
  }
}
