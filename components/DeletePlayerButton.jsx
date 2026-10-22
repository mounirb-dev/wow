"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { request } from "@/lib/api-client.js";

// Borra un jugador tras confirmar. El borrado es real y en cascada (noticias, clubes interesados,
// señales y objetivos del staff), así que no puede volver a aparecer. `redirectTo` lleva al
// listado cuando se borra desde la ficha; `compact` muestra solo el icono (filas del listado).
export default function DeletePlayerButton({ id, name, redirectTo = null, compact = false }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await request(`/api/players/${id}`, { method: "DELETE" });
      toast.success(`${name} borrado`);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      {compact
        ? <Button variant="ghost" size="icon-sm" aria-label={`Borrar ${name}`} className="text-muted-foreground hover:text-destructive"><Trash2 aria-hidden="true" /></Button>
        : <Button variant="outline" size="sm" className="text-destructive"><Trash2 aria-hidden="true" /> Borrar jugador</Button>}
    </DialogTrigger>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>¿Borrar a {name}?</DialogTitle>
        <DialogDescription>Se eliminan también sus noticias, clubes interesados y datos del staff. No se puede deshacer.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancelar</Button>
        <Button variant="destructive" onClick={remove} disabled={deleting}>{deleting ? "Borrando…" : "Borrar"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
