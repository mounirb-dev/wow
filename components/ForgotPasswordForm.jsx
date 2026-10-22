"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { m } from "motion/react";
import OtpInput from "@/components/ui/otp-input";

const errorCopy = {
  email: "Escribe un email válido.",
  send: "No se pudo enviar el código. Revisa el email o la configuración de correo de Appwrite.",
  verify: "El código no es válido o ha caducado.",
  password: "Las contraseñas no coinciden o no cumplen la política del proyecto.",
};
const inputClass = "h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none focus:border-foreground";
const primaryButton = "h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90";
const backLink = <Link href="/login" className="mt-6 block text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Volver al acceso</Link>;

const ErrorNotice = ({ children }) => <p role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{children}</p>;

// Campo de contraseña con botón de mostrar/ocultar. La etiqueta va aparte del botón para que cada
// <label> identifique un único control.
function PasswordField({ id, name, label, placeholder }) {
  const [visible, setVisible] = useState(false);
  return <div>
    <label className="block text-sm font-medium" htmlFor={id}>{label}</label>
    <div className="relative mt-2">
      <input id={id} name={name} type={visible ? "text" : "password"} minLength={8} required className={`${inputClass} pr-12`} placeholder={placeholder} autoComplete="new-password" />
      <button type="button" onClick={() => setVisible((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>{visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
    </div>
  </div>;
}

// Paso 2: el usuario escribe el código de 6 dígitos; al completarlo se envía solo.
function CodeStep({ verifyError }) {
  const [code, setCode] = useState("");
  const form = useRef(null);
  return <form ref={form} action="/api/auth/recovery/verify-code" method="post" className="mt-8 flex flex-col gap-5">
    <div>
      <label htmlFor="recovery-code" className="mb-3 block text-sm font-medium">Código de verificación</label>
      <OtpInput id="recovery-code" value={code} onChange={setCode} onComplete={() => setTimeout(() => form.current?.requestSubmit(), 0)} length={6} size="sm" autoFocus aria-label="Código de recuperación de seis dígitos" status={verifyError ? "error" : "idle"} slotClassName={verifyError ? "border border-red-500/80 bg-red-50 text-foreground dark:bg-red-950/30" : "border border-input bg-background text-foreground"} />
      <input type="hidden" name="secret" value={code} readOnly />
    </div>
    {!verifyError && <p className="text-sm text-muted-foreground">Introduce los seis dígitos. La contraseña aparecerá sólo después de validarlos.</p>}
    <button type="submit" disabled={code.length !== 6} className="sr-only">Validar código</button>
  </form>;
}

// Paso 3: código ya verificado, el usuario fija la nueva contraseña.
function NewPasswordStep() {
  return <>
    <m.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.28, ease: "easeOut" }} className="mt-8 flex gap-1.5" role="img" aria-label="Código verificado">
      {Array.from({ length: 6 }, (_, index) => (
        <m.span key={index} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.2 }} className="grid size-10 place-items-center rounded-lg border border-emerald-500/80 bg-emerald-50 text-sm font-semibold text-emerald-700 dark:border-emerald-400/80 dark:bg-emerald-950/40 dark:text-emerald-300" aria-hidden="true">✓</m.span>
      ))}
    </m.div>
    <m.form action="/api/auth/recovery/verify" method="post" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.35, ease: "easeOut" }} className="mt-7 flex flex-col gap-5">
      <PasswordField id="password" name="password" label="Nueva contraseña" placeholder="Mínimo 8 caracteres" />
      <PasswordField id="passwordAgain" name="passwordAgain" label="Repite la contraseña" placeholder="Repite la contraseña" />
      <button type="submit" className={primaryButton}>Cambiar contraseña</button>
    </m.form>
  </>;
}

// Recuperación de contraseña. Estados según los parámetros que devuelven las rutas
// /api/auth/recovery/*: sin `sent` pide el email; con `sent` pide el código; con `verified`
// pide la nueva contraseña.
export default function ForgotPasswordForm({ error, sent, verified }) {
  if (sent) {
    const verifyError = error === "verify";
    return (
      <section className="w-full max-w-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Recuperación</p>
        <h1 className="editorial-heading mt-4 text-4xl">Introduce el código.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Appwrite ha enviado un código de seis dígitos al email asociado a tu cuenta.</p>
        {error && !verifyError && <ErrorNotice>{errorCopy[error] ?? errorCopy.verify}</ErrorNotice>}
        {verified ? <NewPasswordStep /> : <CodeStep verifyError={verifyError} />}
        <section className="mt-8 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">¿No te ha llegado?</p>
          <form action="/api/auth/recovery/resend" method="post" className="mt-2">
            <button type="submit" className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground">Reenviar código</button>
          </form>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">El código anterior caduca cuando solicitas uno nuevo.</p>
        </section>
        {backLink}
      </section>
    );
  }

  return (
    <section className="w-full max-w-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Acceso</p>
      <h1 className="editorial-heading mt-4 text-4xl">Recupera tu acceso.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Escribe tu email y te enviaremos un código de un solo uso.</p>
      {error && <ErrorNotice>{errorCopy[error] ?? errorCopy.send}</ErrorNotice>}
      <form action="/api/auth/recovery" method="post" className="mt-8 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={`mt-2 ${inputClass}`} placeholder="tu@club.com" />
        </div>
        <button type="submit" className={primaryButton}>Enviar código</button>
      </form>
      {backLink}
    </section>
  );
}
