"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import OtpInput from "@/components/ui/otp-input";

const errorCopy = {
  email: "Escribe un email válido.",
  send: "No se pudo enviar el código. Revisa el email o la configuración de correo de Appwrite.",
  verify: "El código no es válido o ha caducado.",
  password: "Las contraseñas no coinciden o no cumplen la política del proyecto.",
};

export default function ForgotPasswordForm({ error, sent, verified }) {
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordAgain, setShowPasswordAgain] = useState(false);
  const codeForm = useRef(null);
  const verifyError = error === "verify";

  if (sent) {
    return (
      <section className="w-full max-w-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#94a3b8]">Recuperación</p>
        <h1 className="editorial-heading mt-4 text-4xl">Introduce el código.</h1>
        <p className="mt-3 text-sm leading-6 text-[#94a3b8]">Appwrite ha enviado un código de seis dígitos al email asociado a tu cuenta.</p>
        {error && !verifyError && <p role="alert" className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-300">{errorCopy[error] ?? errorCopy.verify}</p>}
        {!verified ? (
          <form ref={codeForm} action="/api/auth/recovery/verify-code" method="post" className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="recovery-code" className="mb-3 block text-sm font-medium">Código de verificación</label>
              <OtpInput id="recovery-code" value={code} onChange={setCode} onComplete={() => setTimeout(() => codeForm.current?.requestSubmit(), 0)} length={6} size="sm" autoFocus aria-label="Código de recuperación de seis dígitos" status={verifyError ? "error" : "idle"} slotClassName={verifyError ? "border border-red-500/80 bg-red-950/30 text-white" : "border border-[#333] bg-[#151515] text-white"} />
              <input type="hidden" name="secret" value={code} readOnly />
            </div>
            {!verifyError && (
              <AnimatePresence initial={false} mode="wait">
                <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-[#94a3b8]">
                  Introduce los seis dígitos. La contraseña aparecerá sólo después de validarlos.
                </motion.p>
              </AnimatePresence>
            )}
            <button type="submit" disabled={code.length !== 6} className="sr-only">Validar código</button>
          </form>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.28, ease: "easeOut" }} className="mt-8 flex gap-1.5" aria-label="Código verificado">
              {Array.from({ length: 6 }, (_, index) => (
                <motion.span key={index} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.2 }} className="grid size-10 place-items-center rounded-lg border border-emerald-400/80 bg-emerald-950/40 text-sm font-semibold text-emerald-300">✓</motion.span>
              ))}
            </motion.div>
            <motion.form action="/api/auth/recovery/verify" method="post" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.35, ease: "easeOut" }} className="mt-7 flex flex-col gap-5">
              <label className="block text-sm font-medium" htmlFor="password">Nueva contraseña
                <span className="relative mt-2 block">
                  <input id="password" name="password" type={showPassword ? "text" : "password"} minLength={8} required className="h-12 w-full rounded-xl border border-[#333] bg-[#151515] px-4 pr-12 text-sm outline-none focus:border-white" placeholder="Mínimo 8 caracteres" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#94a3b8] hover:bg-white/10 hover:text-white" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </span>
              </label>
              <label className="block text-sm font-medium" htmlFor="passwordAgain">Repite la contraseña
                <span className="relative mt-2 block">
                  <input id="passwordAgain" name="passwordAgain" type={showPasswordAgain ? "text" : "password"} minLength={8} required className="h-12 w-full rounded-xl border border-[#333] bg-[#151515] px-4 pr-12 text-sm outline-none focus:border-white" placeholder="Repite la contraseña" />
                  <button type="button" onClick={() => setShowPasswordAgain((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#94a3b8] hover:bg-white/10 hover:text-white" aria-label={showPasswordAgain ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPasswordAgain ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </span>
              </label>
              <button type="submit" className="h-12 w-full rounded-xl bg-[#f4f1e8] text-sm font-semibold text-black hover:bg-white">Cambiar contraseña</button>
            </motion.form>
          </>
        )}

        <section className="mt-8 border-t border-[#262626] pt-5">
          <p className="text-sm text-[#94a3b8]">¿No te ha llegado?</p>
          <form action="/api/auth/recovery/resend" method="post" className="mt-2">
            <button type="submit" className="text-sm font-medium text-white underline underline-offset-4 hover:text-[#94a3b8]">Reenviar código</button>
          </form>
          <p className="mt-2 text-xs leading-5 text-[#64748b]">El código anterior caduca cuando solicitas uno nuevo.</p>
        </section>
        <Link href="/login" className="mt-6 block text-center text-sm text-[#94a3b8] underline underline-offset-4 hover:text-white">Volver al acceso</Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#94a3b8]">Acceso</p>
      <h1 className="editorial-heading mt-4 text-4xl">Recupera tu acceso.</h1>
      <p className="mt-3 text-sm leading-6 text-[#94a3b8]">Escribe tu email y te enviaremos un código de un solo uso.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-300">{errorCopy[error] ?? errorCopy.send}</p>}
      <form action="/api/auth/recovery" method="post" className="mt-8 flex flex-col gap-4">
        <label className="block text-sm font-medium" htmlFor="email">Email<input id="email" name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-[#333] bg-[#151515] px-4 text-sm outline-none focus:border-white" placeholder="tu@club.com" /></label>
        <button type="submit" className="h-12 w-full rounded-xl bg-[#f4f1e8] text-sm font-semibold text-black hover:bg-white">Enviar código</button>
      </form>
      <Link href="/login" className="mt-6 block text-center text-sm text-[#94a3b8] underline underline-offset-4 hover:text-white">Volver al acceso</Link>
    </section>
  );
}
