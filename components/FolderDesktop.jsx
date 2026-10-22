"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { canConfigureAccess } from "@/lib/folder-access.js";
import { downloadPath, plural } from "@/lib/files.js";
import { useFileDrop } from "@/lib/use-file-drop.js";
import { useFolderFiles } from "@/lib/use-folder-files.js";
import { useSubfolders } from "@/lib/use-subfolders.js";
import DeleteFolderDialog from "./DeleteFolderDialog.jsx";
import DesktopContent from "./DesktopContent.jsx";
import FileViewer from "./FileViewer.jsx";
import { DesktopActions, DesktopTitle, DesktopViewControls } from "./DesktopToolbar.jsx";
import FolderAccessDialog from "./FolderAccessDialog.jsx";

// Escritorio estilo Finder de una carpeta: subcarpetas y archivos como iconos (o lista), menú
// contextual (clic derecho), doble clic para abrir y arrastrar archivos para subirlos. Solo
// presenta; los permisos (editor+) y el acceso por carpeta los impone la API.
// `current` = fila de la carpeta ({ $id, restricted, allowedUserIds, createdBy }) y `viewer` =
// { userId, role } del usuario, para saber si puede cambiar el acceso. Sin `folderId` es la vista
// raíz ("todas las carpetas"): solo subcarpetas.
export default function FolderDesktop({ folderId, name, canEdit, canCreateFolders, initialFolders = [], current = null, viewer = null, onOpenFolder = null }) {
  const router = useRouter();
  const isRoot = folderId == null;
  const canUpload = canEdit && !isRoot;
  const { folders, createFolder, renameFolder, removeFolder, patchFolder } = useSubfolders({ parentId: folderId ?? null, initialFolders, refresh: () => router.refresh() });
  const { files, loading, uploading, progress, upload, removeFile } = useFolderFiles(folderId);
  const { dragging, dropProps } = useFileDrop(canUpload, upload);
  const [currentAccess, setCurrentAccess] = useState({ restricted: Boolean(current?.restricted), allowedUserIds: current?.allowedUserIds ?? [] });
  const [accessTarget, setAccessTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const fileInput = useRef(null);

  const needle = query.trim().toLocaleLowerCase();
  const matches = (label) => !needle || label.toLocaleLowerCase().includes(needle);
  const mayConfigure = (folder) => Boolean(canEdit && viewer && folder && canConfigureAccess(viewer, folder));

  const handlers = {
    select: setSelected,
    startRename: setRenaming,
    openAccess: setAccessTarget,
    askDelete: setDeleteTarget,
    preview: setPreviewFile,
    removeFile,
    openFolder: (id) => (onOpenFolder ? onOpenFolder(id) : router.push(`/folders/${id}`)),
    download: (file) => { window.location.href = downloadPath(file); },
    async finishCreate(label) {
      setCreating(false);
      const folder = await createFolder(label);
      if (folder) setSelected(`folder:${folder.$id}`);
    },
    async finishRename(id, label) {
      setRenaming(null);
      const previous = id === folderId ? name : folders.find((folder) => folder.$id === id)?.name;
      if (label.trim() !== previous) await renameFolder(id, label);
    },
  };

  async function confirmDelete(folder) {
    if (await removeFolder(folder.$id)) {
      setDeleteTarget(null);
      setSelected(null);
    }
  }

  function accessSaved(id, access) {
    if (id === folderId) setCurrentAccess(access); else patchFolder(id, access);
    router.refresh();
  }

  const subtitle = loading ? "Cargando…" : `${plural(folders.length, "carpeta", "carpetas")} · ${plural(files.length, "archivo", "archivos")}`;

  return <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border bg-card" aria-label="Escritorio de la carpeta">
    <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-3">
      <DesktopTitle
        name={name}
        subtitle={subtitle}
        renaming={!isRoot && renaming === folderId}
        canRename={!isRoot && canCreateFolders && canEdit}
        restricted={currentAccess.restricted}
        onStartRename={() => setRenaming(folderId)}
        onRename={(label) => handlers.finishRename(folderId, label)}
        onAccess={mayConfigure(current) ? () => setAccessTarget({ ...current, name, ...currentAccess }) : null}
      />
      <DesktopViewControls query={query} onQuery={setQuery} view={view} onView={setView} />
      {canEdit && <DesktopActions onNewFolder={canCreateFolders ? () => { setCreating(true); setView("grid"); setSelected(null); } : null} onPickFiles={canUpload ? () => fileInput.current?.click() : null} uploading={uploading} progress={progress} />}
      {canUpload && <input ref={fileInput} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { upload(event.target.files); event.target.value = ""; }} />}
    </header>
    <div
      role="presentation"
      onClick={() => setSelected(null)}
      onKeyDown={(event) => { if (event.key === "Escape") setSelected(null); }}
      {...dropProps}
      className={`relative min-h-80 flex-1 p-4 transition-colors ${dragging ? "bg-primary/10 ring-2 ring-inset ring-primary" : ""}`}
    >
      {dragging && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-medium text-primary">Suelta los archivos para subirlos</p>}
      <DesktopContent
        loading={loading}
        total={folders.length + files.length}
        folders={folders.filter((folder) => matches(folder.name))}
        files={files.filter((file) => matches(file.name))}
        query={query}
        list={view === "list"}
        creating={creating}
        isRoot={isRoot}
        canEdit={canEdit}
        selected={selected}
        renaming={renaming}
        mayConfigure={mayConfigure}
        handlers={handlers}
      />
    </div>
    <FolderAccessDialog folder={accessTarget} onClose={() => setAccessTarget(null)} onSaved={accessSaved} />
    <FileViewer file={previewFile} files={files} onClose={() => setPreviewFile(null)} />
    <DeleteFolderDialog folder={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
  </section>;
}
