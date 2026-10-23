"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Confirmación antes de borrar una carpeta: el borrado incluye subcarpetas y archivos y no se puede
// deshacer. `folder` = { $id, name } o null (cerrado); `onConfirm(folder)` devuelve cuando termina.
export default function DeleteFolderDialog({ folder, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  // Mientras se borra se bloquean los botones y el diálogo no se puede cerrar (ver onOpenChange), para
  // que no haya dos borrados a la vez ni se cierre a medias.
  async function confirm() {
    setDeleting(true);
    try { await onConfirm(folder); } finally { setDeleting(false); }
  }

  return <Dialog open={Boolean(folder)} onOpenChange={(next) => { if (!next && !deleting) onClose(); }}>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>¿Eliminar “{folder?.name}”?</DialogTitle>
        <DialogDescription>Se borran también sus subcarpetas y todos los archivos que contiene. No se puede deshacer.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={deleting}>Cancelar</Button>
        <Button variant="destructive" onClick={confirm} disabled={deleting}>{deleting ? "Eliminando…" : "Eliminar"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
