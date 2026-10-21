"use client";

import Link from "next/link";
import { Folder, FolderPlus, Pencil, Save } from "lucide-react";
import { useState } from "react";

export default function FolderManager({ folder, childrenFolders = [] }) {
  const [name, setName] = useState(folder.name);
  const [children, setChildren] = useState(childrenFolders);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function rename(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/workspace/folders/${folder.$id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    setSaving(false);
    if (response.ok) { setEditing(false); setMessage("Nombre guardado"); }
    else setMessage("No se pudo guardar");
  }

  async function createChild(event) {
    event.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;
    const response = await fetch("/api/workspace/folders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: cleanName, parentId: folder.$id }) });
    const payload = await response.json();
    if (response.ok) { setChildren((current) => [...current, payload.folder]); setNewName(""); setMessage("Subcarpeta creada"); }
    else setMessage(payload.error || "No se pudo crear la subcarpeta");
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-wider text-muted-foreground">Carpeta compartida</p>{editing ? <form onSubmit={rename} className="mt-2 flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} autoFocus className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm" /><button disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground"><Save className="size-3.5" />Guardar</button></form> : <h2 className="mt-1 truncate text-lg font-medium">{name}</h2>}</div>
      {!editing && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-secondary"><Pencil className="size-3.5" />Cambiar nombre</button>}
    </div>
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-medium">Secciones</h3><p className="text-sm text-muted-foreground">Crea carpetas dentro de esta carpeta y compártelas con el workspace.</p></div><form onSubmit={createChild} className="flex gap-2"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nueva sección" className="w-36 rounded-md border bg-background px-3 py-2 text-xs" aria-label="Nombre de la subcarpeta" /><button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground"><FolderPlus className="size-3.5" />Crear</button></form></div>
      {children.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children.map((child) => <Link key={child.$id} href={`/folders/${child.$id}`} className="flex items-center gap-3 rounded-lg border p-3 text-sm transition hover:bg-secondary"><Folder className="size-4 text-muted-foreground" /><span className="truncate">{child.name}</span></Link>)}</div>}
      {message && <p className="mt-3 text-xs text-muted-foreground" role="status">{message}</p>}
    </div>
  </section>;
}
