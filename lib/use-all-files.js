"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { request } from "./api-client.js";

// Todos los archivos del workspace a los que el usuario puede entrar (GET /api/workspace/files).
// `null` mientras carga; lista vacía si la carga falla (el error se avisa con un toast).
export function useAllFiles() {
  const [files, setFiles] = useState(null);

  useEffect(() => {
    let cancelled = false;
    request("/api/workspace/files")
      .then((payload) => { if (!cancelled) setFiles(payload.files); })
      .catch((error) => { if (!cancelled) { setFiles([]); toast.error(error.message); } });
    return () => { cancelled = true; };
  }, []);

  return files;
}
