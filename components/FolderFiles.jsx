"use client";

import { useEffect, useState } from "react";
import { FilePlus, FileText, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FolderFiles({ folderId, initialFiles = [] }) {
  const [files, setFiles] = useState(() => initialFiles.map((name) => ({ name, type: "" })));

  useEffect(() => {
    if (!folderId.startsWith("custom-")) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(`agentsolver:files:${folderId}`) || "null");
      if (Array.isArray(saved)) setFiles(saved.map((name) => ({ name, type: "" })));
    } catch { /* Ignore malformed local demo data. */ }
  }, [folderId]);

  function addFiles(event) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    const next = [...files, ...selected.map((file) => ({ name: file.name, type: file.type, url: URL.createObjectURL(file) }))];
    setFiles(next);
    window.localStorage.setItem(`agentsolver:files:${folderId}`, JSON.stringify(next.map((file) => file.name)));
    event.target.value = "";
  }

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-4 border-b p-5">
        <div className="flex items-center gap-3"><FolderOpen className="size-5 text-muted-foreground" /><div><h2 className="font-medium">Fichero de archivos</h2><p className="text-sm text-muted-foreground">{files.length} {files.length === 1 ? "archivo" : "archivos"}</p></div></div>
        <Button asChild size="sm"><label className="cursor-pointer"><FilePlus data-icon="inline-start" />Añadir archivo<input type="file" multiple className="sr-only" onChange={addFiles} /></label></Button>
      </header>
      <div className="p-3">
        {files.length ? <div className="flex flex-col gap-1">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-lg px-3 py-3"><FileText className="size-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm">{file.name}</span><span className="text-xs text-muted-foreground">Archivo</span></div>)}</div> : <div className="flex flex-col items-center gap-2 px-6 py-12 text-center"><FolderOpen className="size-8 text-muted-foreground" /><p className="text-sm font-medium">Este fichero está vacío</p><p className="text-sm text-muted-foreground">Añade documentos para tenerlos ordenados en esta carpeta.</p></div>}
      </div>
    </section>
  );
}
