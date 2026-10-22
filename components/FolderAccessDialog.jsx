"use client";

import { useEffect, useState } from "react";
import { Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const JSON_HEADERS = { "content-type": "application/json" };
const modeClass = (active) => `flex flex-1 items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${active ? "border-primary bg-primary/10" : "hover:bg-secondary"}`;

// Quién puede entrar en una carpeta (y en sus subcarpetas y archivos). Owner/admin y quien creó la
// carpeta siempre tienen acceso. `folder` = { $id, name, restricted, allowedUserIds, createdBy };
// `onSaved(id, { restricted, allowedUserIds })` avisa al padre tras guardar.
export default function FolderAccessDialog({ folder, onClose, onSaved }) {
  const [members, setMembers] = useState(null);
  const [restricted, setRestricted] = useState(false);
  const [allowed, setAllowed] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const open = Boolean(folder);

  // Cada vez que se abre sobre una carpeta se parte de su estado guardado.
  useEffect(() => {
    if (!folder) return;
    setRestricted(Boolean(folder.restricted));
    setAllowed(new Set(folder.allowedUserIds ?? []));
  }, [folder]);

  useEffect(() => {
    if (!open || members) return;
    let cancelled = false;
    fetch("/api/workspace/members", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("members"))))
      .then((data) => { if (!cancelled) setMembers((data.members ?? []).filter((member) => member.status === "active")); })
      .catch(() => { if (!cancelled) toast.error("No se pudo cargar la lista de miembros"); });
    return () => { cancelled = true; };
  }, [open, members]);

  const toggle = (userId) => setAllowed((current) => {
    const next = new Set(current);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/workspace/folders/${folder.$id}`, { method: "PATCH", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify({ restricted, allowedUserIds: [...allowed] }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "No se pudo guardar el acceso");
      const payload = await response.json();
      onSaved(folder.$id, { restricted: payload.folder?.restricted ?? restricted, allowedUserIds: payload.folder?.allowedUserIds ?? [...allowed] });
      toast.success(restricted ? "Carpeta restringida" : "Carpeta abierta a todo el workspace");
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  const managers = (members ?? []).filter((member) => ["owner", "admin"].includes(member.role));
  const others = (members ?? []).filter((member) => !["owner", "admin"].includes(member.role) && member.userId !== folder?.createdBy);

  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Acceso a “{folder?.name}”</DialogTitle>
        <DialogDescription>Elige quién puede ver esta carpeta, sus subcarpetas y sus archivos.</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2" role="group" aria-label="Quién puede entrar">
        <button type="button" onClick={() => setRestricted(false)} aria-pressed={!restricted} className={modeClass(!restricted)}><Globe aria-hidden="true" className="size-4 shrink-0" /><span><span className="block font-medium">Todo el workspace</span><span className="block text-xs text-muted-foreground">Cualquier miembro</span></span></button>
        <button type="button" onClick={() => setRestricted(true)} aria-pressed={restricted} className={modeClass(restricted)}><Lock aria-hidden="true" className="size-4 shrink-0" /><span><span className="block font-medium">Solo elegidos</span><span className="block text-xs text-muted-foreground">Acceso limitado</span></span></button>
      </div>
      {restricted && <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1" role="group" aria-label="Miembros con acceso">
        {!members && <p className="p-3 text-center text-sm text-muted-foreground">Cargando miembros…</p>}
        {managers.map((member) => <label key={member.$id} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-70"><input type="checkbox" checked disabled className="size-4 accent-primary" /><span className="min-w-0 flex-1 truncate">{member.name || member.email}</span><span className="text-xs text-muted-foreground">Siempre</span></label>)}
        {others.map((member) => <label key={member.$id} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-secondary"><input type="checkbox" checked={allowed.has(member.userId)} onChange={() => toggle(member.userId)} className="size-4 accent-primary" /><span className="min-w-0 flex-1 truncate">{member.name || member.email}</span><span className="text-xs text-muted-foreground">{member.role}</span></label>)}
        {members && !others.length && <p className="p-3 text-center text-xs text-muted-foreground">No hay más miembros: invítalos desde “Compartir workspace”.</p>}
      </div>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={save} disabled={saving || (restricted && !members)}>{saving ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
