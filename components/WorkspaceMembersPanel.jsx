"use client";

import { useRef, useState } from "react";
import { UserPlus, Users, X } from "lucide-react";

const JSON_HEADERS = { "content-type": "application/json" };
const fieldClass = "rounded-md border bg-background px-3 py-2 text-sm";

// Lo que se le cuenta a quien invita: si la persona recibió el email para crear su cuenta o hay que avisarla.
const inviteMessage = ({ emailSent }) => (emailSent === true ? "Invitación enviada: le ha llegado un email para crear su cuenta" : emailSent === false ? "Añadido, pero no se pudo enviar el email: puede pedir su enlace en /onboarding" : "Miembro añadido");

// Lista de miembros e invitaciones del workspace (/api/workspace/members). Invitar y cambiar
// roles solo funciona para owner/admin; la API lo impone, la UI solo lo refleja.
// Usa <dialog> nativo: el navegador gestiona el foco atrapado, Escape y el fondo.
export default function WorkspaceMembersPanel({ collapsed = false }) {
  const dialogRef = useRef(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function show() {
    dialogRef.current?.showModal();
    try {
      const response = await fetch("/api/workspace/members");
      if (response.ok) setMembers((await response.json()).members);
      else setMessage("No se pudieron cargar los miembros");
    } catch {
      setMessage("No se pudieron cargar los miembros");
    }
  }

  // Escritura con guarda de reentrada: ignora clics mientras hay otra en curso y siempre libera `busy`.
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

  function invite(event) {
    event.preventDefault();
    mutate("/api/workspace/members", "POST", { email, role }, (payload) => { setMembers((current) => [...current, payload.member]); setEmail(""); setMessage(inviteMessage(payload)); }, "No se pudo añadir");
  }

  function changeRole(id, nextRole) {
    mutate(`/api/workspace/members/${id}`, "PATCH", { role: nextRole }, (payload) => setMembers((current) => current.map((member) => member.$id === id ? payload.member : member)), "No se pudo cambiar el rol");
  }

  return <>
    <button onClick={show} type="button" title={collapsed ? "Compartir workspace" : undefined} className={`flex h-8 w-full min-w-0 items-center gap-3 rounded-md text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground ${collapsed ? "justify-center px-0" : "px-3"}`}>
      <Users className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">Compartir workspace</span> : <span className="min-w-0 truncate">Compartir workspace</span>}
    </button>
    <dialog ref={dialogRef} aria-labelledby="members-title" className="m-auto w-full max-w-lg rounded-xl border bg-card p-5 text-card-foreground shadow-xl backdrop:bg-black/40">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p><h2 id="members-title" className="mt-1 text-lg font-medium">Miembros y acceso</h2><p className="mt-1 text-sm text-muted-foreground">Controla quién puede ver o editar el staff.</p></div>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Cerrar" className="rounded-md p-2 hover:bg-secondary"><X className="size-4" aria-hidden="true" /></button>
      </div>
      <form onSubmit={invite} className="mt-5 grid gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-end">
        <label className="grid gap-1 text-xs text-muted-foreground"><span>Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@club.com" className={`text-foreground ${fieldClass}`} /></label>
        <label className="grid gap-1 text-xs text-muted-foreground"><span>Permiso</span><select value={role} onChange={(event) => setRole(event.target.value)} className={`text-foreground ${fieldClass}`}><option value="viewer">Puede ver</option><option value="editor">Puede editar</option><option value="admin">Administrador</option></select></label>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"><UserPlus className="size-4" aria-hidden="true" />Añadir</button>
      </form>
      <div className="mt-5 divide-y rounded-lg border">{members.map((member) => <div key={member.$id} className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.email} · {member.status}</p></div>
        <select aria-label={`Permiso de ${member.name}`} disabled={member.role === "owner" || busy} value={member.role} onChange={(event) => changeRole(member.$id, event.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs"><option value="owner">Propietario</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Solo lectura</option></select>
      </div>)}</div>
      {message && <p className="mt-3 text-xs text-muted-foreground" role="status">{message}</p>}
    </dialog>
  </>;
}
