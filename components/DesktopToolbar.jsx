"use client";

import { FilePlus, FolderPlus, Globe, LayoutGrid, List, Lock, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MacFolderIcon } from "./MacIcons.jsx";
import { RenameInput } from "./DesktopItems.jsx";

// Título de la carpeta (renombrable) con su estado de acceso. `onAccess` solo se pasa si el
// usuario puede cambiar la restricción.
export function DesktopTitle({ name, subtitle, renaming, canRename, restricted, onStartRename, onRename, onAccess }) {
  return <div className="mr-auto flex min-w-0 items-center gap-3">
    <MacFolderIcon className="w-7 shrink-0" />
    <div className="min-w-0">
      {renaming ? <RenameInput initial={name} onDone={onRename} align="left" /> : <h2 className="truncate text-sm font-medium">{name}</h2>}
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
    {canRename && !renaming && <Button variant="ghost" size="icon-sm" onClick={onStartRename} aria-label="Cambiar nombre de la carpeta"><Pencil /></Button>}
    {onAccess && <Button variant="outline" size="sm" onClick={onAccess}>{restricted ? <Lock data-icon="inline-start" /> : <Globe data-icon="inline-start" />}{restricted ? "Restringida" : "Acceso"}</Button>}
    {!onAccess && restricted && <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground"><Lock aria-hidden="true" className="size-3" />Restringida</span>}
  </div>;
}

// Buscador y selector de vista (iconos / lista).
export function DesktopViewControls({ query, onQuery, view, onView }) {
  return <>
    <label className="flex h-8 w-44 items-center gap-2 rounded-md border bg-background px-2 text-sm focus-within:ring-2 focus-within:ring-ring"><Search aria-hidden="true" className="size-3.5 text-muted-foreground" /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar" aria-label="Buscar en la carpeta" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
    <div className="flex rounded-md border bg-background p-0.5" role="group" aria-label="Vista">
      <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" onClick={() => onView("grid")} aria-label="Vista de iconos" aria-pressed={view === "grid"}><LayoutGrid /></Button>
      <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" onClick={() => onView("list")} aria-label="Vista de lista" aria-pressed={view === "list"}><List /></Button>
    </div>
  </>;
}

// Acciones de escritura (editor+): nueva carpeta y añadir archivos. Cada una es opcional.
// `progress` (0 a 1) se muestra mientras se sube.
export function DesktopActions({ onNewFolder, onPickFiles, uploading, progress = null }) {
  return <>
    {onNewFolder && <Button variant="outline" size="sm" onClick={onNewFolder}><FolderPlus data-icon="inline-start" />Nueva carpeta</Button>}
    {onPickFiles && <Button size="sm" disabled={uploading} onClick={onPickFiles}><FilePlus data-icon="inline-start" />{uploading ? `Subiendo… ${Math.round((progress ?? 0) * 100)} %` : "Añadir archivo"}</Button>}
  </>;
}
