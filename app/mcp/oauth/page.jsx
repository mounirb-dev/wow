import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from "@/lib/session.js";
import { Apple } from "@/components/ui/svgs/apple.jsx";
import { Google } from "@/components/ui/svgs/google.jsx";

export const metadata = { title: "Conectar MCP · AgentSolver" };

const permissions = [
  "Consultar jugadores y contratos",
  "Leer el resumen de la cartera",
  "Preparar informes de negociación",
];

export default async function McpOAuthPage({ searchParams }) {
  const params = await searchParams;
  const clientName = typeof params?.client_name === "string" ? params.client_name : "Cliente MCP";
  const mcpUrl = process.env.NEXT_PUBLIC_MCP_URL ?? process.env.MCP_PUBLIC_URL ?? "";
  const isConfigured = Boolean(mcpUrl);
  const user = await getUser();
  const returnTo = `/mcp/oauth?${new URLSearchParams(typeof params === "object" ? params : {}).toString()}`;
  const loginUrl = (provider) => `/api/auth/oauth/${provider}?next=${encodeURIComponent(returnTo)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-[460px]">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver a AgentSolver
        </Link>

        <Card className="overflow-hidden border-border bg-card shadow-2xl shadow-black/20">
          <CardHeader className="border-b border-border px-6 pb-6 pt-7 sm:px-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                <LockKeyhole className="size-5" />
              </div>
              <Badge variant={isConfigured ? "default" : "secondary"}>
                {isConfigured ? "HTTPS listo" : "Configuración pendiente"}
              </Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight">Conectar con AgentSolver</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">
              {clientName} solicita acceso al MCP de tu workspace.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <UserRound className="size-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Cuenta</p>
                <p className="truncate text-sm font-medium">{user ? user.email : "Inicia sesión para continuar"}</p>
              </div>
            </div>

            {!user && (
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="h-10">
                  <Link href={loginUrl("apple")}><Apple data-icon="inline-start" />Apple</Link>
                </Button>
                <Button asChild variant="outline" className="h-10">
                  <Link href={loginUrl("google")}><Google className="size-4" aria-label="Google" />Google</Link>
                </Button>
              </div>
            )}

            <section aria-labelledby="permissions-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="permissions-title" className="text-sm font-medium">Permisos solicitados</h2>
                <ShieldCheck className="size-4 text-muted-foreground" />
              </div>
              <ul className="space-y-3">
                {permissions.map((permission) => (
                  <li key={permission} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      <Check className="size-3" />
                    </span>
                    {permission}
                  </li>
                ))}
              </ul>
            </section>

            {!isConfigured && (
              <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-200">
                Esta pantalla ya está lista, pero el endpoint HTTPS del MCP todavía necesita una URL pública en <code className="font-mono">NEXT_PUBLIC_MCP_URL</code>.
              </p>
            )}

            {isConfigured && <p className="break-all rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">Servidor: <span className="font-mono text-foreground">{mcpUrl}</span></p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
                <Link href="/">Cancelar</Link>
              </Button>
              <Button disabled={!isConfigured || !user} className="min-w-32">
                Autorizar acceso
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          OAuth con PKCE · Permisos limitados al workspace
        </p>
      </div>
    </main>
  );
}
