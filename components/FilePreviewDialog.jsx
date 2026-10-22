"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadPath, formatDate, formatSize, previewKind, viewPath } from "@/lib/files.js";

// Vista previa de una foto, un vídeo o un audio sin salir de la carpeta. `file` = documento o null
// (cerrado). El navegador pide el archivo con Range, así que el vídeo se puede adelantar sin bajarlo entero.
export default function FilePreviewDialog({ file, onClose }) {
  const kind = file ? previewKind(file) : null;
  const src = file ? viewPath(file) : undefined;
  const details = file ? [formatSize(file.size), formatDate(file.$createdAt)].filter(Boolean).join(" · ") : "";

  return <Dialog open={Boolean(file)} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="truncate">{file?.name}</DialogTitle>
        <DialogDescription>{details}</DialogDescription>
      </DialogHeader>
      <div className="grid min-h-0 place-items-center overflow-auto rounded-lg bg-muted/40">
        {kind === "image" && <img src={src} alt={file.name} className="max-h-[70dvh] w-auto max-w-full object-contain" />}
        {kind === "video" && <video src={src} controls playsInline preload="metadata" className="max-h-[70dvh] w-full" aria-label={file.name} />}
        {kind === "audio" && <audio src={src} controls preload="metadata" className="w-full p-6" aria-label={file.name} />}
      </div>
      {file && <div className="flex justify-end"><Button asChild variant="outline" size="sm"><a href={downloadPath(file)}><Download aria-hidden="true" /> Descargar</a></Button></div>}
    </DialogContent>
  </Dialog>;
}
