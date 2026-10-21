"use client";

import { useEffect, useState } from "react";
import { FileDown, FilePlus, FileText, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function FolderFiles({ folderId, initialFiles = [] }) {
  const [files, setFiles] = useState(initialFiles);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workspace/folders/${folderId}/files`, { credentials: "include" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los archivos");
        if (!cancelled) setFiles(payload.files || []);
      })
      .catch((error) => { if (!cancelled) toast.error(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [folderId]);

  async function addFiles(event) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setUploading(true);
    const uploaded = [];
    try {
      for (const file of selected) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(`/api/workspace/folders/${folderId}/files`, { method: "POST", credentials: "include", body });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `No se pudo subir ${file.name}`);
        uploaded.push(payload.file);
      }
      setFiles((current) => [...uploaded, ...current]);
      toast.success(`${uploaded.length} archivo${uploaded.length === 1 ? "" : "s"} guardado${uploaded.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
    event.target.value = "";
  }

  async function removeFile(file) {
    const response = await fetch(`/api/workspace/folders/${folderId}/files/${file.$id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) { toast.error("No se pudo borrar el archivo"); return; }
    setFiles((current) => current.filter((item) => item.$id !== file.$id));
    toast.success("Archivo borrado");
  }

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-4 border-b p-5">
        <div className="flex items-center gap-3"><FolderOpen className="size-5 text-muted-foreground" /><div><h2 className="font-medium">Fichero de archivos</h2><p className="text-sm text-muted-foreground">{files.length} {files.length === 1 ? "archivo" : "archivos"}</p></div></div>
        <Button asChild size="sm" disabled={uploading}><label className="cursor-pointer"><FilePlus data-icon="inline-start" />{uploading ? "Guardando…" : "Añadir archivo"}<input type="file" multiple className="sr-only" onChange={addFiles} disabled={uploading} /></label></Button>
      </header>
      <div className="p-3">
        {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Cargando archivos…</p> : files.length ? <div className="flex flex-col gap-1">{files.map((file) => <div key={file.$id} className="flex items-center gap-3 rounded-lg px-3 py-3"><FileText className="size-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm">{file.name}</span><a href={file.downloadUrl} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Descargar ${file.name}`}><FileDown className="size-4" /></a><button type="button" onClick={() => removeFile(file)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Borrar ${file.name}`}><Trash2 className="size-4" /></button></div>)}</div> : <div className="flex flex-col items-center gap-2 px-6 py-12 text-center"><FolderOpen className="size-8 text-muted-foreground" /><p className="text-sm font-medium">Este fichero está vacío</p><p className="text-sm text-muted-foreground">Añade documentos para guardarlos en el workspace.</p></div>}
      </div>
    </section>
  );
}
