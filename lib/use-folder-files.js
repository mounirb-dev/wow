"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { request } from "./api-client.js";
import { plural } from "./files.js";
import { uploadFile } from "./upload-client.js";

const JSON_HEADERS = { "content-type": "application/json" };

// Archivos de una carpeta: carga, subida (varios a la vez, por partes), cambio de nombre y borrado. Sin `folderId`
// (la vista de "todas las carpetas") no hay archivos que cargar. `progress` es null o un número
// de 0 a 1 mientras se sube (suma de todos los archivos en curso).
export function useFolderFiles(folderId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(Boolean(folderId));
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!folderId) return;
    let cancelled = false;
    request(`/api/workspace/folders/${folderId}/files`)
      .then((payload) => { if (!cancelled) setFiles(payload.files || []); })
      .catch((error) => { if (!cancelled) toast.error(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [folderId]);

  async function upload(list) {
    const selected = Array.from(list || []);
    if (!selected.length) return;
    const total = selected.reduce((sum, file) => sum + file.size, 0) || 1;
    const sentBy = new Array(selected.length).fill(0);
    setProgress(0);
    // Subidas en paralelo: una que falle no impide guardar las demás.
    const send = (file, index) => uploadFile(folderId, file, (bytes) => {
      sentBy[index] = bytes;
      setProgress(sentBy.reduce((sum, value) => sum + value, 0) / total);
    });
    try {
      const results = await Promise.allSettled(selected.map(send));
      const uploaded = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      if (uploaded.length) { setFiles((current) => [...uploaded, ...current]); toast.success(plural(uploaded.length, "archivo guardado", "archivos guardados")); }
      results.forEach((result, index) => { if (result.status === "rejected") toast.error(`${selected[index].name}: ${result.reason.message}`); });
    } finally {
      setProgress(null);
    }
  }

  async function removeFile(file) {
    try {
      await request(`/api/workspace/folders/${folderId}/files/${file.$id}`, { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.$id !== file.$id));
      toast.success("Archivo borrado");
    } catch (error) { toast.error(error.message); }
  }

  // El servidor limpia el nombre (separadores, espacios…): se guarda en el estado lo que devuelve, no lo escrito.
  async function renameFile(file, label) {
    const name = label.trim();
    if (!name || name === file.name) return;
    try {
      const { file: renamed } = await request(`/api/workspace/folders/${folderId}/files/${file.$id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ name }) });
      setFiles((current) => current.map((item) => (item.$id === file.$id ? { ...item, name: renamed.name } : item)));
    } catch (error) { toast.error(error.message); }
  }

  return { files, loading, progress, uploading: progress !== null, upload, removeFile, renameFile };
}
