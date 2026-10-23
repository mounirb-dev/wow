"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import BrandLogo from "./BrandLogo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { Google } from "./ui/svgs/google.jsx";

// Pantalla de acceso: Google (redirección OAuth) o email + contraseña (formulario POST normal a
// /api/auth/login, sin JavaScript de por medio). `error` llega por la URL (?error=…) desde las rutas de
// auth y se muestra tal cual; `next` es la ruta a la que volver tras entrar.
export default function ModernAnimatedSignIn({ error, next = "/" }) {
  // Tras entrar se vuelve a `next` (p. ej. al consentimiento de /mcp/oauth); por defecto, al resumen.
  const googleHref = `/api/auth/oauth/google?next=${encodeURIComponent(next)}`;
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="login-surface flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="absolute right-5 top-5"><ThemeToggle compact /></div>
      <Card className="w-full max-w-[420px] border-border bg-card text-card-foreground shadow-2xl shadow-black/10 dark:shadow-black/40">
        <CardHeader className="px-7 pb-5 pt-8 text-center sm:px-9">
          <BrandLogo className="mx-auto mb-5 h-16" />
          <CardTitle className="editorial-heading text-3xl">Entra al panel.</CardTitle>
        </CardHeader>
        <CardContent className="px-7 sm:px-9">
          <Button asChild variant="outline" className="h-11 w-full border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground">
            <a href={googleHref}><Google className="size-4" aria-label="Google" />Google</a>
          </Button>
          <div className="my-7 flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground"><Separator className="bg-border" />o<Separator className="bg-border" /></div>
          <form action="/api/auth/login" method="post" className="flex flex-col gap-5">
            <input type="hidden" name="next" value={next} />
            <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="email">Email<Input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@club.com" className="h-12 border-input bg-background text-foreground placeholder:text-muted-foreground" /></label>
            <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="password">Contraseña
              <span className="relative"><Input id="password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Tu contraseña" className="h-12 border-input bg-background pr-12 text-foreground placeholder:text-muted-foreground" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span>
            </label>
            {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs leading-5 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{decodeURIComponent(error)}</p>}
            <Button type="submit" className="h-12 bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">Entrar<ArrowRight data-icon="inline-end" /></Button>
            <Link href="/forgot-password" className="text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">¿Has olvidado tu contraseña?</Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
