"use client";

import Link from "next/link";
import { Folder, FolderPlus, Pencil, Save } from "lucide-react";
import { useState } from "react";

const JSON_HEADERS = { "content-type": "application/json" };

// Cabecera de una carpeta compartida: renombrarla y crear subcarpetas. Solo muestra el estado;
// los permisos (editor+) los impone la API.
export default function FolderManager({ folder, childrenFolders = [] }) {
  // `savedName` sobrescribe la prop tras guardar; así no se copia la prop en el estado (quedaría obsoleta).
  const [savedName, setSavedName] = useState(null);
  const [draft, setDraft] = useState("");
  const [children, setChildren] = useState(childrenFolders);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const name = savedName ?? folder.name;

  // Envuelve una escritura: evita dobles envíos, resetea `busy` pase lo que pase y no lee el
  // cuerpo de respuestas con error como si fueran datos.
  async function mutate(url, method, body, onSuccess, failure) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
      if (response.ok) onSuccess(await response.json().catch(() => ({})));
      else setMessage((await response.json().catch(() => ({}))).error || failure);
    } catch {
      setMessage(failure);
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    setDraft(name);
    setEditing(true);
  }

  function rename(event) {
    event.preventDefault();
    mutate(`/api/workspace/folders/${folder.$id}`, "PATCH", { name: draft }, () => { setSavedName(draft.trim()); setEditing(false); setMessage("Nombre guardado"); }, "No se pudo guardar");
  }

  function createChild(event) {
    event.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;
    mutate("/api/workspace/folders", "POST", { name: cleanName, parentId: folder.$id }, (payload) => { setChildren((current) => [...current, payload.folder]); setNewName(""); setMessage("Subcarpeta creada"); }, "No se pudo crear la subcarpeta");
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Carpeta compartida</p>
        {editing
          ? <form onSubmit={rename} className="mt-2 flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Nombre de la carpeta" autoFocus className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm" /><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-60"><Save className="size-3.5" aria-hidden="true" />Guardar</button></form>
          : <h2 className="mt-1 truncate text-lg font-medium">{name}</h2>}
      </div>
      {!editing && <button type="button" onClick={startEditing} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-secondary"><Pencil className="size-3.5" aria-hidden="true" />Cambiar nombre</button>}
    </div>
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-medium">Secciones</h3><p className="text-sm text-muted-foreground">Crea carpetas dentro de esta carpeta y compártelas con el workspace.</p></div>
        <form onSubmit={createChild} className="flex gap-2"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nueva sección" className="w-36 rounded-md border bg-background px-3 py-2 text-xs" aria-label="Nombre de la subcarpeta" /><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-60"><FolderPlus className="size-3.5" aria-hidden="true" />Crear</button></form>
      </div>
      {children.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children.map((child) => <Link key={child.$id} href={`/folders/${child.$id}`} className="flex items-center gap-3 rounded-lg border p-3 text-sm transition hover:bg-secondary"><Folder className="size-4 text-muted-foreground" aria-hidden="true" /><span className="truncate">{child.name}</span></Link>)}</div>}
      {message && <p className="mt-3 text-xs text-muted-foreground" role="status">{message}</p>}
    </div>
  </section>;
}
