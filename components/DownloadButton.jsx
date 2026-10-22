"use client";

import { Download } from "lucide-react";
import { downloadPath } from "@/lib/files.js";

// Descarga un archivo del workspace: navega a la ruta de descarga (la API responde con
// Content-Disposition: attachment, así que no se sale de la página).
export default function DownloadButton({ file }) {
  return <button type="button" onClick={() => { window.location.href = downloadPath(file); }} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Descargar ${file.name}`}><Download className="size-4" /></button>;
}
