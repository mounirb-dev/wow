import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import BrandLogo from "@/components/BrandLogo.jsx";
import ThemeToggle from "@/components/ThemeToggle.jsx";
import { MIN_PASSWORD, ONBOARDING_ERRORS } from "@/lib/onboarding.js";

export const metadata = { title: "wow · Crea tu cuenta" };

const inputClass = "h-12 border-input bg-background text-foreground placeholder:text-muted-foreground";

// Destino del enlace del email de invitación (/onboarding?userId&secret): nombre y contraseña. Sin enlace válido
// (caducado, ya usado o abierto a mano) enseña el formulario para pedir otro por email.
export default async function Onboarding({ searchParams }) {
  const { userId, secret, error, sent } = await searchParams;
  const hasLink = Boolean(userId && secret);
  const message = error ? ONBOARDING_ERRORS[error] ?? "No se pudo completar el alta. Inténtalo de nuevo." : null;

  return <main className="login-surface flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6">
    <div className="absolute right-5 top-5"><ThemeToggle compact /></div>
    <Card className="w-full max-w-[420px] border-border bg-card text-card-foreground shadow-2xl shadow-black/10 dark:shadow-black/40">
      <CardHeader className="px-7 pb-5 pt-8 text-center sm:px-9">
        <BrandLogo className="mx-auto mb-5 h-16" />
        <CardTitle className="editorial-heading text-3xl">{hasLink ? "Crea tu cuenta." : "Pide tu enlace."}</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">{hasLink ? "Te han invitado a un workspace de wow. Elige cómo te llamas y una contraseña." : "Escribe el email al que te invitaron y te mandamos un enlace nuevo."}</p>
      </CardHeader>
      <CardContent className="px-7 pb-8 sm:px-9">
        {message && <p role="alert" className="mb-5 rounded-lg border border-red-300 bg-red-50 p-3 text-xs leading-5 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{message}</p>}
        {sent === "1" && <p role="status" className="mb-5 rounded-lg border p-3 text-xs leading-5 text-muted-foreground">Si ese email tiene una invitación pendiente, te hemos enviado un enlace nuevo. Revisa también el spam.</p>}
        {hasLink
          ? <form action="/api/auth/onboarding" method="post" className="flex flex-col gap-5">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="secret" value={secret} />
            <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="name">Nombre<Input id="name" name="name" required maxLength={128} autoComplete="name" placeholder="Tu nombre y apellidos" className={inputClass} /></label>
            <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="password">Contraseña<Input id="password" name="password" type="password" required minLength={MIN_PASSWORD} maxLength={128} autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} className={inputClass} /></label>
            <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="confirm">Repite la contraseña<Input id="confirm" name="confirm" type="password" required minLength={MIN_PASSWORD} maxLength={128} autoComplete="new-password" className={inputClass} /></label>
            <Button type="submit" className="h-12 bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">Crear cuenta y entrar</Button>
          </form>
          : <form action="/api/auth/onboarding/resend" method="post" className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="email">Email<Input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@club.com" className={inputClass} /></label>
            <Button type="submit" className="h-12 bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">Enviarme un enlace</Button>
          </form>}
      </CardContent>
    </Card>
  </main>;
}
