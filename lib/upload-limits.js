// Constantes y cuentas puras de la subida de archivos por partes, compartidas entre el navegador y
// el servidor (sin dependencias).
//
// Por qué por partes: una función serverless no admite cuerpos de petición mayores de ~4,5 MB (Vercel),
// así que un vídeo no puede subirse de una vez. El navegador corta el archivo en partes de 4 MB, el
// servidor guarda cada una como un archivo de Storage y la fila de `documents` las enumera (`partIds`).
export const PART_SIZE = 4 * 1024 * 1024;

// Tope por archivo. Configurable con MAX_UPLOAD_MB; por defecto 1 GB.
export const DEFAULT_MAX_UPLOAD_MB = 1024;
export function maxUploadBytes(env = process.env) {
  const mb = Number(env.MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
}

export const partCount = (size) => Math.ceil(size / PART_SIZE);

// Bytes que debe tener la parte `index` de un archivo de `size` bytes (la última es más corta).
export const partLength = (size, index) => Math.min(PART_SIZE, size - index * PART_SIZE);

// Id de Storage de una parte: determinista (documento + posición) y válido para Appwrite (<= 36).
export const partId = (documentId, index) => `p${documentId}_${index}`;
