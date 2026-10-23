"use client";

import { useRef, useState } from "react";
import { LogOut, Settings, X } from "lucide-react";

const JSON_HEADERS = { "content-type": "application/json" };
const fieldClass = "rounded-md border bg-background px-3 py-2 text-sm text-foreground";
const rowClass = (collapsed) => `flex h-8 w-full min-w-0 items-center gap-3 rounded-md text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground ${collapsed ? "justify-center px-0" : "px-3"}`;

// Ajustes de la cuenta (cambiar el email) y cierre de sesión. Usa <dialog> nativo, igual que el panel de
// miembros: el navegador gestiona el foco, Escape y el fondo. Cerrar sesión es un formulario POST normal.
export default function AccountMenu({ collapsed = false, email, emailVerified = true }) {
  const dialogRef = useRef(null);
  const [current, setCurrent] = useState(email);
  const [verified, setVerified] = useState(emailVerified);
  const [next, setNext] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/email", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ email: next, password }) });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        setMessage(failure.error || "No se pudo cambiar el email");
        return;
      }
      const payload = await response.json().catch(() => ({}));
      setCurrent(payload.email); setVerified(false); setNext(""); setPassword("");
      setMessage(payload.verificationSent ? `Email cambiado. Te hemos enviado un enlace a ${payload.email}: ábrelo para confirmarlo` : "Email cambiado, pero no se pudo enviar el enlace de confirmación. Pídelo de nuevo abajo");
    } catch {
      setMessage("No se pudo cambiar el email");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/email/resend", { method: "POST" });
      setMessage(response.ok ? `Enlace enviado a ${current}` : (await response.json().catch(() => ({}))).error || "No se pudo enviar el enlace");
    } catch {
      setMessage("No se pudo enviar el enlace");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" onClick={() => dialogRef.current?.showModal()} title={collapsed ? "Ajustes" : undefined} className={rowClass(collapsed)}>
      <Settings className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">Ajustes</span> : <span className="min-w-0 truncate">Ajustes</span>}
    </button>
    <form action="/api/auth/logout" method="post" className="contents">
      <button type="submit" title={collapsed ? "Cerrar sesión" : undefined} className={rowClass(collapsed)}>
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        {collapsed ? <span className="sr-only">Cerrar sesión</span> : <span className="min-w-0 truncate">Cerrar sesión</span>}
      </button>
    </form>
    <dialog ref={dialogRef} aria-labelledby="account-title" className="m-auto w-full max-w-md rounded-xl border bg-card p-5 text-card-foreground shadow-xl backdrop:bg-black/40">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Cuenta</p><h2 id="account-title" className="mt-1 text-lg font-medium">Ajustes</h2><p className="mt-1 text-sm text-muted-foreground">Tu email actual es <b className="text-foreground">{current}</b>.</p></div>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Cerrar" className="rounded-md p-2 hover:bg-secondary"><X className="size-4" aria-hidden="true" /></button>
      </div>
      {!verified && <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground"><span>Sin confirmar: abre el enlace que te enviamos a ese email.</span><button type="button" onClick={resend} disabled={busy} className="shrink-0 rounded-md border px-2 py-1 text-foreground hover:bg-secondary disabled:opacity-60">Reenviar</button></div>}
      <form onSubmit={save} className="mt-5 grid gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground"><span>Nuevo email</span><input type="email" required autoComplete="email" value={next} onChange={(event) => setNext(event.target.value)} placeholder="nuevo@club.com" className={fieldClass} /></label>
        <label className="grid gap-1 text-xs text-muted-foreground"><span>Contraseña actual</span><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} /></label>
        <button type="submit" disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60">{busy ? "Guardando…" : "Cambiar email"}</button>
      </form>
      {message && <p className="mt-3 text-xs text-muted-foreground" role="status">{message}</p>}
    </dialog>
  </>;
}
