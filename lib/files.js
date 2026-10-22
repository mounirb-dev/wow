// Utilidades de presentación de archivos y carpetas (sin dependencias de React).
export const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

export const extensionOf = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

export const kindLabel = (name) => (extensionOf(name) ? `Documento ${extensionOf(name).toUpperCase()}` : "Documento");

// Locale y zona horaria fijos: servidor y navegador generan el mismo texto (sin desajuste de hidratación).
const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : "");

// Ruta de descarga de un archivo, construida a partir de sus ids (no se confía en una URL ya hecha).
export const downloadPath = (file) => `/api/workspace/folders/${encodeURIComponent(file.folderId)}/files/${encodeURIComponent(file.$id)}`;

// Tamaño legible ("1,5 MB"). Cadena vacía si no se conoce (archivos anteriores a las subidas por partes).
const sizeFormat = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${unit === 0 ? value : sizeFormat.format(value)} ${units[unit]}`;
}

// Tipos que el navegador puede mostrar dentro de la página (foto, vídeo, audio) y que se sirven "inline".
// Todo lo demás se descarga. Sin SVG ni HTML: un archivo subido nunca se ejecuta en nuestro origen.
const INLINE_KIND = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image", "image/gif": "image", "image/avif": "image",
  "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
  "audio/mpeg": "audio", "audio/mp4": "audio", "audio/wav": "audio", "audio/ogg": "audio", "audio/webm": "audio",
};
const EXTENSION_MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
};

// Content-Type seguro para mostrar el archivo inline, o null si solo se puede descargar. Se fía del tipo
// guardado solo si está en la lista; si no, de la extensión.
// Las tablas se consultan solo por clave propia: un nombre como "x.constructor" o "x.__proto__" no
// puede resolver a algo del prototipo de Object.
const own = (table, key) => (typeof key === "string" && Object.hasOwn(table, key) ? table[key] : null);
export const inlineMime = (file) => (own(INLINE_KIND, file?.mimeType) ? file.mimeType : own(EXTENSION_MIME, extensionOf(file?.name)));

// "image" | "video" | "audio" | null: cómo se previsualiza un archivo en la interfaz.
export const previewKind = (file) => own(INLINE_KIND, inlineMime(file));

// Ruta para mostrar el archivo inline (vista previa), construida a partir de sus ids.
export const viewPath = (file) => `${downloadPath(file)}?inline=1`;
