"use client";

import { useState } from "react";
import { UserPlus, Users, X } from "lucide-react";
import { useUiStore } from "@/lib/ui-store.js";

// Lista de miembros e invitaciones del workspace (/api/workspace/members). Invitar y cambiar
// roles solo funciona para owner/admin; la API lo impone, la UI solo lo refleja.
export default function WorkspaceMembersPanel() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");

  async function show() {
    setOpen(true);
    const response = await fetch("/api/workspace/members");
    if (response.ok) setMembers((await response.json()).members);
  }

  async function invite(event) {
    event.preventDefault();
    const response = await fetch("/api/workspace/members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role }) });
    const payload = await response.json();
    if (response.ok) { setMembers((current) => [...current, payload.member]); setEmail(""); setMessage("Miembro añadido"); }
    else setMessage(payload.error || "No se pudo añadir");
  }

  async function changeRole(id, nextRole) {
    const response = await fetch(`/api/workspace/members/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: nextRole }) });
    if (response.ok) { const payload = await response.json(); setMembers((current) => current.map((member) => member.$id === id ? payload.member : member)); }
  }

  return <><button onClick={show} type="button" aria-label="Compartir workspace" title={collapsed ? "Compartir workspace" : undefined} className={`flex h-8 w-full min-w-0 items-center gap-3 rounded-md text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground ${collapsed ? "justify-center px-0" : "px-3"}`}><Users className="size-4 shrink-0" />{!collapsed && <span className="min-w-0 truncate">Compartir workspace</span>}</button>{open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p><h2 className="mt-1 text-lg font-medium">Miembros y acceso</h2><p className="mt-1 text-sm text-muted-foreground">Controla quién puede ver o editar el staff.</p></div><button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-md p-2 hover:bg-secondary"><X className="size-4" /></button></div><form onSubmit={invite} className="mt-5 grid gap-2 sm:grid-cols-[1fr_130px_auto]"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@club.com" className="rounded-md border bg-background px-3 py-2 text-sm" /><select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="viewer">Puede ver</option><option value="editor">Puede editar</option><option value="admin">Administrador</option></select><button className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><UserPlus className="size-4" />Añadir</button></form><div className="mt-5 divide-y rounded-lg border">{members.map((member) => <div key={member.$id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.email} · {member.status}</p></div><select disabled={member.role === "owner"} value={member.role} onChange={(event) => changeRole(member.$id, event.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs"><option value="owner">Propietario</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Solo lectura</option></select></div>)}</div>{message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}</div></div>}</>;
}
