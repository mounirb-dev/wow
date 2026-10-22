"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { request } from "./api-client.js";
import { plural } from "./files.js";

// Archivos de una carpeta: carga, subida (varios a la vez) y borrado. Sin `folderId` (la vista de
// "todas las carpetas") no hay archivos que cargar.
export function useFolderFiles(folderId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(Boolean(folderId));
  const [uploading, setUploading] = useState(false);

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
    setUploading(true);
    // Subidas en paralelo: una que falle no impide guardar las demás.
    const send = async (file) => {
      const body = new FormData();
      body.append("file", file);
      return (await request(`/api/workspace/folders/${folderId}/files`, { method: "POST", body })).file;
    };
    try {
      const results = await Promise.allSettled(selected.map(send));
      const uploaded = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      if (uploaded.length) { setFiles((current) => [...uploaded, ...current]); toast.success(plural(uploaded.length, "archivo guardado", "archivos guardados")); }
      for (const result of results) if (result.status === "rejected") toast.error(result.reason.message);
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(file) {
    try {
      await request(`/api/workspace/folders/${folderId}/files/${file.$id}`, { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.$id !== file.$id));
      toast.success("Archivo borrado");
    } catch (error) { toast.error(error.message); }
  }

  return { files, loading, uploading, upload, removeFile };
}
