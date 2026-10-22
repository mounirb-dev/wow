"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useAllFiles } from "@/lib/use-all-files.js";
import { formatDate, kindLabel, plural } from "@/lib/files.js";
import DownloadButton from "./DownloadButton.jsx";
import { MacFileIcon, MacFolderIcon } from "./MacIcons.jsx";

// Todos los archivos del workspace (de las carpetas a las que el usuario puede entrar), con la
// carpeta de cada uno. `onOpenFolder(id)` salta a su carpeta.
export default function AllFilesView({ onOpenFolder }) {
  const files = useAllFiles();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLocaleLowerCase();
  const shown = (files ?? []).filter((file) => !needle || file.name.toLocaleLowerCase().includes(needle) || file.folderPath.toLocaleLowerCase().includes(needle));

  return <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border bg-card" aria-label="Todos los archivos">
    <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-3">
      <div className="mr-auto"><h2 className="text-sm font-medium">Todos los archivos</h2><p className="text-xs text-muted-foreground">{files ? `${plural(files.length, "archivo", "archivos")} en el workspace` : "Cargando…"}</p></div>
      <label className="flex h-8 w-56 items-center gap-2 rounded-md border bg-background px-2 text-sm focus-within:ring-2 focus-within:ring-ring"><Search aria-hidden="true" className="size-3.5 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar archivo o carpeta" aria-label="Buscar entre todos los archivos" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
    </header>
    <div className="flex-1 overflow-y-auto p-2">
      {!files && <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>}
      {files && !files.length && <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><MacFolderIcon className="w-20 opacity-60" /><p className="text-sm font-medium">Todavía no hay archivos</p><p className="max-w-xs text-sm text-muted-foreground">Los archivos que subas a cualquier carpeta aparecerán aquí.</p></div>}
      {files?.length > 0 && !shown.length && <p className="py-16 text-center text-sm text-muted-foreground">Sin resultados para “{query}”.</p>}
      <ul className="flex flex-col gap-0.5">
        {shown.map((file) => <li key={file.$id} className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-foreground/5">
          <MacFileIcon name={file.name} className="h-7 w-6 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <button type="button" onClick={() => onOpenFolder(file.folderId)} className="hidden max-w-48 items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground sm:flex" title={`Abrir ${file.folderPath}`}><MacFolderIcon className="w-4 shrink-0" /><span className="truncate">{file.folderPath}</span></button>
          <span className="hidden w-32 text-xs text-muted-foreground md:block">{kindLabel(file.name)}</span>
          <span className="hidden w-28 text-xs text-muted-foreground lg:block">{formatDate(file.$createdAt)}</span>
          <DownloadButton file={file} />
        </li>)}
      </ul>
    </div>
  </section>;
}
