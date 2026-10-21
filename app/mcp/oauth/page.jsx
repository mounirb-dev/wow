// /mcp/oauth — pantalla de consentimiento del flujo OAuth del MCP. El cliente (p. ej. Claude)
// envía aquí al usuario; si no tiene sesión se le manda al login y vuelve con los mismos
// parámetros. Al pulsar "Autorizar" se hace POST a /api/mcp/oauth/authorize.
import Link from "next/link";
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { validateAuthorizeRequest } from "@/lib/mcp-oauth.js";
import { getUser } from "@/lib/session.js";

export const metadata = { title: "Conectar MCP · AgentSolver" };
export const dynamic = "force-dynamic";

const permissions = [
  "Consultar jugadores y contratos",
  "Leer el resumen de la cartera",
  "Preparar informes de negociación",
];
const hiddenFields = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state"];

export default async function McpOAuthPage({ searchParams }) {
  const raw = await searchParams;
  const params = Object.fromEntries(Object.entries(raw).filter(([, value]) => typeof value === "string"));
  const checked = validateAuthorizeRequest(params);
  const user = await getUser();
  const returnTo = `/mcp/oauth?${new URLSearchParams(params).toString()}`;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-[460px] overflow-hidden border-border bg-card shadow-2xl shadow-black/20">
        <CardHeader className="border-b border-border px-6 pb-6 pt-7 sm:px-8">
          <div className="mb-6 grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><LockKeyhole className="size-5" aria-hidden="true" /></div>
          <CardTitle className="text-2xl tracking-tight">Conectar con AgentSolver</CardTitle>
          <CardDescription className="mt-2 text-sm leading-6">
            {checked.fatal ? "No se puede completar la conexión." : `${checked.client.name} solicita acceso al MCP de tu workspace.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 py-6 sm:px-8">
          {checked.fatal && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">{checked.fatal}. Vuelve a añadir el conector desde el cliente.</p>}
          {!checked.fatal && !user && (
            <>
              <p className="text-sm text-muted-foreground">Inicia sesión para autorizar el acceso.</p>
              <Button asChild className="w-full"><Link href={`/login?next=${encodeURIComponent(returnTo)}`}>Iniciar sesión</Link></Button>
            </>
          )}
          {!checked.fatal && user && (
            <form action="/api/mcp/oauth/authorize" method="post" className="space-y-6">
              {hiddenFields.map((name) => params[name] !== undefined && <input key={name} type="hidden" name={name} value={params[name]} />)}
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm"><span className="text-xs text-muted-foreground">Cuenta</span><br /><span className="font-medium">{user.email}</span></p>
              <section aria-labelledby="permissions-title">
                <div className="mb-3 flex items-center justify-between"><h2 id="permissions-title" className="text-sm font-medium">Permisos solicitados</h2><ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" /></div>
                <ul className="space-y-3">{permissions.map((permission) => (
                  <li key={permission} className="flex items-start gap-3 text-sm text-muted-foreground"><span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Check className="size-3" aria-hidden="true" /></span>{permission}</li>
                ))}</ul>
              </section>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="submit" name="decision" value="deny" variant="ghost" className="text-muted-foreground">Cancelar</Button>
                <Button type="submit" name="decision" value="allow" className="min-w-32">Autorizar acceso</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
