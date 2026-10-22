// Utilidades de presentación de archivos y carpetas (sin dependencias de React).
export const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

export const extensionOf = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

export const kindLabel = (name) => (extensionOf(name) ? `Documento ${extensionOf(name).toUpperCase()}` : "Documento");

// Locale y zona horaria fijos: servidor y navegador generan el mismo texto (sin desajuste de hidratación).
const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : "");

// Ruta de descarga de un archivo, construida a partir de sus ids (no se confía en una URL ya hecha).
export const downloadPath = (file) => `/api/workspace/folders/${encodeURIComponent(file.folderId)}/files/${encodeURIComponent(file.$id)}`;
