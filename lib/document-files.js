// Contenido de un documento (lógica sin Appwrite). Un documento nuevo guarda sus bytes como partes
// (`partIds`, ver lib/upload-limits.js); los anteriores tienen un único binario (`storageFileId`) y
// siguen funcionando. `read(id)` se inyecta: devuelve los bytes de un archivo de Storage.
import { PART_SIZE } from "./upload-limits.js";

// Nombre de archivo seguro: sin separadores de ruta ni caracteres de control, <= 255. Vacío si no queda nada.
export const cleanFileName = (value) => String(value ?? "").toWellFormed().replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 255);

// Ids de Storage que hay que borrar para eliminar el documento.
export const binaryIds = (document) => (document.partIds?.length ? document.partIds : [document.storageFileId]).filter(Boolean);

// Lo que el cliente necesita de un documento. Los ids internos de Storage no salen del servidor.
export const publicFile = (folderId, { partIds: _partIds, storageFileId: _storageFileId, ...document }) => ({ ...document, downloadUrl: `/api/workspace/folders/${folderId}/files/${document.$id}` });

// Cabecera Range de un solo tramo ("bytes=0-99", "bytes=500-", "bytes=-100").
// Devuelve null si no hay cabecera, "invalid" si no se puede satisfacer, o { start, end } (ambos incluidos).
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (match[1] === "" && match[2] === "")) return "invalid";
  let start;
  let end;
  if (match[1] === "") {
    // Sufijo: los últimos N bytes.
    start = Math.max(size - Number(match[2]), 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start >= size || start > end ? "invalid" : { start, end };
}

// Flujo con los bytes [start, end] de un documento por partes, leyendo una parte cada vez (nunca el
// archivo entero en memoria).
export function streamParts(document, start, end, read) {
  const first = Math.floor(start / PART_SIZE);
  const last = Math.floor(end / PART_SIZE);
  let index = first;
  return new ReadableStream({
    async pull(controller) {
      if (index > last) { controller.close(); return; }
      const bytes = Buffer.from(await read(document.partIds[index]));
      const from = index === first ? start - index * PART_SIZE : 0;
      const to = index === last ? end - index * PART_SIZE + 1 : bytes.length;
      controller.enqueue(new Uint8Array(bytes.subarray(from, to)));
      index += 1;
    },
  });
}
