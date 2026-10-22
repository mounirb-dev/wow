"use client";

import { FileItem, FolderItem, RenameInput } from "./DesktopItems.jsx";
import { itemClass } from "./desktop-styles.js";
import { MacFolderIcon } from "./MacIcons.jsx";

const emptyText = (isRoot, canEdit) => {
  if (!canEdit) return "Todavía no hay nada compartido aquí.";
  return isRoot ? "Crea una carpeta para organizar el trabajo del equipo." : "Arrastra archivos aquí o crea una carpeta para organizar el trabajo del equipo.";
};

// Estados vacíos y rejilla/lista de iconos del escritorio. Presentacional: todo llega por props.
// `folders`/`files` ya vienen filtrados por la búsqueda; `total` = cuántos hay sin filtrar.
export default function DesktopContent({ loading, total, folders, files, query, list, creating, isRoot, canEdit, selected, renaming, mayConfigure, handlers }) {
  const empty = !loading && !total && !creating;
  const noResults = !loading && !empty && !folders.length && !files.length && !creating;
  if (loading) return <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>;
  if (empty) return <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><MacFolderIcon className="w-20 opacity-60" /><p className="text-sm font-medium">{isRoot ? "Aún no hay carpetas" : "Esta carpeta está vacía"}</p><p className="max-w-xs text-sm text-muted-foreground">{emptyText(isRoot, canEdit)}</p></div>;
  if (noResults) return <p className="py-16 text-center text-sm text-muted-foreground">Sin resultados para “{query}”.</p>;
  return <div className={list ? "flex flex-col gap-0.5" : "grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] items-start gap-2"}>
    {creating && <div className={`${itemClass(false)} items-center`}><MacFolderIcon className="w-16" /><RenameInput initial="Carpeta sin título" onDone={handlers.finishCreate} /></div>}
    {folders.map((folder) => <FolderItem key={folder.$id} folder={folder} list={list} selected={selected === `folder:${folder.$id}`} renaming={renaming === folder.$id} canEdit={canEdit} canConfigure={mayConfigure(folder)} onSelect={() => handlers.select(`folder:${folder.$id}`)} onOpen={() => handlers.openFolder(folder.$id)} onStartRename={() => handlers.startRename(folder.$id)} onRename={(label) => handlers.finishRename(folder.$id, label)} onAccess={() => handlers.openAccess(folder)} onDelete={() => handlers.askDelete(folder)} />)}
    {files.map((file) => <FileItem key={file.$id} file={file} list={list} selected={selected === `file:${file.$id}`} canEdit={canEdit} onSelect={() => handlers.select(`file:${file.$id}`)} onPreview={() => handlers.preview(file)} onDownload={() => handlers.download(file)} onRemove={() => handlers.removeFile(file)} />)}
  </div>;
}
