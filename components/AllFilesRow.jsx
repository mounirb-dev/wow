"use client";

import { Eye } from "lucide-react";
import { formatDate, formatSize, kindLabel, previewKind } from "@/lib/files.js";
import DownloadButton from "./DownloadButton.jsx";
import { MacFileIcon, MacFolderIcon } from "./MacIcons.jsx";

// Una fila de «Todos los archivos». Foto, vídeo y audio tienen «Ver» (abre la vista previa que gestiona
// la vista, `onPreview(file)`); el resto solo se descarga.
export default function AllFilesRow({ file, onOpenFolder, onPreview }) {
  return <li className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-foreground/5">
    <MacFileIcon name={file.name} className="h-7 w-6 shrink-0" />
    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
    <button type="button" onClick={() => onOpenFolder(file.folderId)} className="hidden max-w-48 items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground sm:flex" title={`Abrir ${file.folderPath}`}><MacFolderIcon className="w-4 shrink-0" /><span className="truncate">{file.folderPath}</span></button>
    <span className="hidden w-32 text-xs text-muted-foreground md:block">{kindLabel(file.name)}</span>
    <span className="hidden w-20 text-right text-xs text-muted-foreground md:block">{formatSize(file.size)}</span>
    <span className="hidden w-28 text-xs text-muted-foreground lg:block">{formatDate(file.$createdAt)}</span>
    {previewKind(file) && <button type="button" onClick={() => onPreview(file)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Ver ${file.name}`}><Eye aria-hidden="true" className="size-4" /></button>}
    <DownloadButton file={file} />
  </li>;
}
