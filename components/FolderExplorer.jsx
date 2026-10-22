"use client";

import { useMemo, useState } from "react";
import { ChevronRight, FolderTree, Files, Lock } from "lucide-react";
import AllFilesView from "./AllFilesView.jsx";
import FolderDesktop from "./FolderDesktop.jsx";
import { MacFolderIcon } from "./MacIcons.jsx";

const ROOT = "root";
const ALL = "all";
const rowClass = (active) => `flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`;

// Sección "Carpetas": árbol de todas las carpetas a las que el usuario puede entrar a la izquierda
// y, a la derecha, el escritorio de la carpeta elegida o la lista de todos los archivos.
// `folders` ya viene filtrado por acceso desde el servidor.
export default function FolderExplorer({ folders, canEdit, viewer }) {
  const [selection, setSelection] = useState(ROOT);
  const [expanded, setExpanded] = useState(() => new Set());
  const byParent = useMemo(() => {
    const map = new Map();
    for (const folder of folders) {
      const key = folder.parentId ?? ROOT;
      map.set(key, [...(map.get(key) ?? []), folder]);
    }
    return map;
  }, [folders]);
  const byId = useMemo(() => new Map(folders.map((folder) => [folder.$id, folder])), [folders]);

  // Seleccionar una carpeta despliega a sus antecesores para que se vea dónde está.
  function open(id) {
    setSelection(id);
    setExpanded((current) => {
      const next = new Set(current);
      for (let folder = byId.get(id), steps = 0; folder && steps < 20; folder = byId.get(folder.parentId), steps++) next.add(folder.$id);
      return next;
    });
  }
  const toggle = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  function node(folder, depth) {
    const children = byParent.get(folder.$id) ?? [];
    const isOpen = expanded.has(folder.$id);
    return <li key={folder.$id}>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        <button type="button" onClick={() => toggle(folder.$id)} disabled={!children.length} aria-label={isOpen ? `Contraer ${folder.name}` : `Expandir ${folder.name}`} aria-expanded={children.length ? isOpen : undefined} className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground disabled:opacity-0"><ChevronRight aria-hidden="true" className={`size-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} /></button>
        <button type="button" onClick={() => open(folder.$id)} aria-current={selection === folder.$id ? "true" : undefined} className={rowClass(selection === folder.$id)}><MacFolderIcon className="w-5 shrink-0" /><span className="min-w-0 flex-1 truncate">{folder.name}</span>{folder.restricted && <Lock aria-label="Acceso restringido" className="size-3 shrink-0" />}</button>
      </div>
      {isOpen && children.length > 0 && <ul>{children.map((child) => node(child, depth + 1))}</ul>}
    </li>;
  }

  const selected = byId.get(selection);
  const children = selected ? byParent.get(selected.$id) ?? [] : byParent.get(ROOT) ?? [];
  const current = selected ? { $id: selected.$id, createdBy: selected.createdBy, restricted: Boolean(selected.restricted), allowedUserIds: selected.allowedUserIds ?? [] } : null;

  return <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
    <nav aria-label="Árbol de carpetas" className="max-h-56 shrink-0 overflow-y-auto rounded-2xl border bg-card p-2 md:max-h-none md:w-64">
      <button type="button" onClick={() => setSelection(ROOT)} className={rowClass(selection === ROOT)}><FolderTree aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">Todas las carpetas</span></button>
      <button type="button" onClick={() => setSelection(ALL)} className={rowClass(selection === ALL)}><Files aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">Todos los archivos</span></button>
      <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Carpetas</p>
      <ul>{(byParent.get(ROOT) ?? []).map((folder) => node(folder, 0))}</ul>
    </nav>
    {selection === ALL
      ? <AllFilesView onOpenFolder={open} />
      // key: al cambiar de carpeta se reinicia el escritorio (archivos, búsqueda, selección).
      : <FolderDesktop key={selection} folderId={selected?.$id ?? null} name={selected?.name ?? "Todas las carpetas"} canEdit={canEdit} canCreateFolders initialFolders={children} current={current} viewer={viewer} onOpenFolder={open} />}
  </div>;
}
