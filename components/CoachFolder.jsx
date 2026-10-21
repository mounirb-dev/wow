"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mockCoachFiles } from "@/lib/mock-data.js";
import { Folder } from "./ui/folder-component.jsx";

export default function CoachFolder({ coach }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState(mockCoachFiles);

  useEffect(() => {
    const saved = window.localStorage.getItem("agentsolver:coach:files");
    if (saved) setFiles([...mockCoachFiles, ...JSON.parse(saved)]);
  }, []);

  function handleUpload(event) {
    const selected = Array.from(event.target.files || []).map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      meta: `${Math.max(1, Math.round(file.size / 1024))} KB · subido ahora`,
      type: "Archivo",
    }));
    if (!selected.length) return;
    const uploaded = [...files.filter((file) => file.type === "Archivo"), ...selected];
    window.localStorage.setItem("agentsolver:coach:files", JSON.stringify(uploaded));
    setFiles([...mockCoachFiles, ...uploaded]);
    event.target.value = "";
    toast.success("Datos del entrenador añadidos", { description: `${selected.length} archivo${selected.length > 1 ? "s" : ""} disponible${selected.length > 1 ? "s" : ""} en la carpeta.` });
  }

  return (
    <>
      <button className="group w-full text-left" onClick={() => setOpen(true)} aria-label={`Abrir carpeta de ${coach.name}`}>
        <Folder color="black" size="sm" className="h-[135px] w-full origin-top scale-[0.78]" />
        <div className="-mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{coach.name}</p><p className="truncate text-xs text-muted-foreground">{coach.club} · {files.length} archivos</p></div>
          <Badge variant="secondary">Staff</Badge>
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader className="border-b pb-5">
            <div className="flex items-start justify-between gap-3"><div><SheetTitle>{coach.name}</SheetTitle><SheetDescription>Carpeta del entrenador · {coach.club}</SheetDescription></div><SheetClose asChild><Button variant="ghost" size="icon" aria-label="Cerrar"><X /></Button></SheetClose></div>
          </SheetHeader>
          <div className="space-y-6 p-5">
            <div className="rounded-md bg-secondary p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Rol</p><p className="mt-1 font-medium">{coach.role}</p></div><Badge variant="secondary">{coach.system}</Badge></div><p className="mt-4 text-sm text-muted-foreground">{coach.notes}</p></div>
            <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Archivos del staff</p>{files.map((file) => <button key={file.id} className="flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left transition hover:bg-secondary"><div className="grid size-9 place-items-center rounded bg-[#edf3ec] text-[#346538]"><FileText className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.meta}</p></div><span className="text-xs text-muted-foreground">{file.type}</span></button>)}</div>
            <input ref={inputRef} type="file" accept=".json,.csv,.txt,.pdf,.doc,.docx" multiple className="hidden" onChange={handleUpload} />
            <Button onClick={() => inputRef.current?.click()} className="w-full"><Upload className="size-4" /> Subir datos del entrenador</Button>
            <p className="text-center text-xs text-muted-foreground">Demo local: los archivos se guardan en este navegador.</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
