"use client";

import { useEffect, useRef } from "react";
import { Download, FolderOpen, Lock, Pencil, Trash2 } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { formatDate, kindLabel } from "@/lib/files.js";
import { itemClass } from "./desktop-styles.js";
import { MacFileIcon, MacFolderIcon } from "./MacIcons.jsx";

const labelClass = (selected) => `line-clamp-2 max-w-full break-words rounded px-1.5 py-0.5 text-xs leading-tight ${selected ? "bg-primary text-primary-foreground" : ""}`;
const rowClass = "!flex-row !gap-3 !text-left";
const select = (event, onSelect) => { event.stopPropagation(); onSelect(); };

// Campo de nombre en línea (como al renombrar en el Finder): Enter o salir del campo confirma,
// Escape cancela. `onDone("")` equivale a cancelar.
export function RenameInput({ initial, onDone, align = "center" }) {
  const input = useRef(null);
  const finished = useRef(false);
  const finish = (value) => { if (finished.current) return; finished.current = true; onDone(value); };
  // El campo aparece porque el usuario pidió renombrar/crear: se enfoca y se selecciona el nombre.
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  return <input
    ref={input}
    defaultValue={initial}
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") finish(event.currentTarget.value); if (event.key === "Escape") finish(""); }}
    onBlur={(event) => finish(event.currentTarget.value)}
    aria-label="Nombre"
    className={`w-full min-w-0 rounded border border-primary bg-background px-1.5 py-0.5 text-xs outline-none ring-2 ring-primary/30 ${align === "center" ? "text-center" : "text-left"}`}
  />;
}

function FolderBody({ folder, list, selected, renaming, onRename }) {
  const label = renaming
    ? <RenameInput initial={folder.name} onDone={onRename} align={list ? "left" : "center"} />
    : null;
  if (!list) {
    return <><span className="relative"><MacFolderIcon className="w-16" />{folder.restricted && <Lock aria-label="Acceso restringido" className="absolute bottom-1 right-1 size-4 rounded-full bg-background p-0.5 text-foreground shadow" />}</span>{label ?? <span className={labelClass(selected)}>{folder.name}</span>}</>;
  }
  return <><MacFolderIcon className="w-7" />{label ?? <span className="min-w-0 flex-1 truncate text-left text-sm">{folder.name}</span>}<span className="hidden w-40 items-center gap-1 text-left text-xs text-muted-foreground sm:flex">{folder.restricted ? <><Lock aria-hidden="true" className="size-3" />Restringida</> : "Carpeta"}</span><span className="hidden w-28 md:block" /></>;
}

// Subcarpeta del escritorio: clic selecciona, doble clic/Enter abre, clic derecho abre el menú.
export function FolderItem({ folder, list, selected, renaming, canEdit, canConfigure, onSelect, onOpen, onStartRename, onRename, onAccess }) {
  return <ContextMenu>
    <ContextMenuTrigger asChild>
      <button type="button" onClick={(event) => select(event, onSelect)} onDoubleClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }} className={`${itemClass(selected)} ${list ? rowClass : ""}`} aria-label={`Carpeta ${folder.name}`}>
        <FolderBody folder={folder} list={list} selected={selected} renaming={renaming} onRename={onRename} />
      </button>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onSelect={onOpen}><FolderOpen />Abrir</ContextMenuItem>
      {canEdit && <ContextMenuItem onSelect={onStartRename}><Pencil />Cambiar nombre</ContextMenuItem>}
      {canConfigure && <ContextMenuItem onSelect={onAccess}><Lock />Acceso…</ContextMenuItem>}
    </ContextMenuContent>
  </ContextMenu>;
}

// Archivo del escritorio: doble clic/Enter descarga; el menú permite descargar y (editor+) eliminar.
export function FileItem({ file, list, selected, canEdit, onSelect, onDownload, onRemove }) {
  return <ContextMenu>
    <ContextMenuTrigger asChild>
      <button type="button" onClick={(event) => select(event, onSelect)} onDoubleClick={onDownload} onKeyDown={(event) => { if (event.key === "Enter") onDownload(); }} className={`${itemClass(selected)} ${list ? rowClass : ""}`} aria-label={`Archivo ${file.name}`}>
        {list
          ? <><MacFileIcon name={file.name} className="h-7 w-6" /><span className="min-w-0 flex-1 truncate text-left text-sm">{file.name}</span><span className="hidden w-40 text-left text-xs text-muted-foreground sm:block">{kindLabel(file.name)}</span><span className="hidden w-28 text-left text-xs text-muted-foreground md:block">{formatDate(file.$createdAt)}</span></>
          : <><MacFileIcon name={file.name} className="h-16" /><span className={labelClass(selected)}>{file.name}</span></>}
      </button>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onSelect={onDownload}><Download />Descargar</ContextMenuItem>
      {canEdit && <><ContextMenuSeparator /><ContextMenuItem variant="destructive" onSelect={onRemove}><Trash2 />Eliminar</ContextMenuItem></>}
    </ContextMenuContent>
  </ContextMenu>;
}
