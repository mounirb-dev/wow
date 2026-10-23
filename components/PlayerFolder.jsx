"use client";

import { useEffect, useState } from "react";
import { Bookmark, FileText, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtM } from "@/lib/tools.js";
import PlayerHeatmap from "./PlayerHeatmap.jsx";
import { Folder } from "./ui/folder-component.jsx";

// Tarjeta "carpeta" de un jugador: al pulsarla abre un panel lateral con su ficha resumida.
// OJO: "Guardar ficha" solo marca el jugador en el localStorage de este navegador (no se sincroniza ni
// llega al servidor), y las tres cifras de Presión/Progresión/Duelos del panel son valores de muestra,
// no datos reales del jugador. Pendiente de sustituir por métricas con fuente.
export default function PlayerFolder({ player }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // El estado "guardado" se lee tras montar (en el servidor no hay localStorage) y se relee si cambia el jugador.
  useEffect(() => {
    setSaved(window.localStorage.getItem(`agentsolver:player:${player.id}`) === "saved");
  }, [player.id]);

  function savePlayer() {
    window.localStorage.setItem(`agentsolver:player:${player.id}`, "saved");
    setSaved(true);
    toast.success("Ficha guardada", { description: `${player.name} está disponible en tu carpeta local.` });
  }

  const files = [
    { name: "Ficha del jugador", meta: "Datos y valoración", icon: "profile" },
    { name: "Historial de valor", meta: "12 meses · gráfico", icon: "chart" },
    { name: "Negociaciones", meta: `${player.suitors.length} clubes interesados`, icon: "deal" },
  ];

  return (
    <>
      <button className="group w-full text-left" onClick={() => setOpen(true)} aria-label={`Abrir carpeta de ${player.name}`}>
        <Folder color="black" size="sm" className="h-[135px] w-full origin-top scale-[0.78]" />
        <div className="-mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{player.name}</p><p className="truncate text-xs text-muted-foreground">{player.club} · {files.length} archivos</p></div>
          {saved && <Badge variant="secondary">Guardado</Badge>}
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader className="border-b pb-5">
            <div className="flex items-start justify-between gap-3">
              <div><SheetTitle>{player.name}</SheetTitle><SheetDescription>Carpeta del jugador · {player.club}</SheetDescription></div>
              <SheetClose asChild><Button variant="ghost" size="icon" aria-label="Cerrar"><X /></Button></SheetClose>
            </div>
          </SheetHeader>
          <div className="space-y-6 p-5">
            <div className="flex items-center justify-between rounded-md bg-secondary p-4"><div><p className="text-xs text-muted-foreground">Valor estimado</p><p className="mt-1 text-3xl font-semibold">{fmtM(player.value)}</p></div><Badge variant="secondary">{player.pos}</Badge></div>
            <PlayerHeatmap position={player.pos} />
            <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-md border p-2"><p className="font-mono text-lg font-semibold">78</p><p className="text-[10px] text-muted-foreground">Presión</p></div><div className="rounded-md border p-2"><p className="font-mono text-lg font-semibold">64</p><p className="text-[10px] text-muted-foreground">Progresión</p></div><div className="rounded-md border p-2"><p className="font-mono text-lg font-semibold">71</p><p className="text-[10px] text-muted-foreground">Duelos</p></div></div>
            <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Archivos</p>{files.map((file) => <button key={file.name} className="flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left transition-[background-color,border-color] hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"><div className="grid size-9 place-items-center rounded bg-secondary text-muted-foreground"><FileText className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.meta}</p></div><span className="text-xs text-muted-foreground">Abrir</span></button>)}</div>
            <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Salario actual</p><p className="mt-1 font-medium">{fmtM(player.salary, 2)}</p></div><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Valor de mercado</p><p className="mt-1 font-medium">{fmtM(player.fair, 2)}</p></div></div>
            <Button onClick={savePlayer} className="w-full"><Bookmark className="size-4" /> {saved ? "Ficha guardada" : "Guardar ficha"}</Button>
            <Button variant="outline" className="w-full"><Plus className="size-4" /> Añadir archivo</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
