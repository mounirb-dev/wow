import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session.js";
import { getWorkspaceContext } from "@/lib/workspace.js";

export const dynamic = "force-dynamic";

export const metadata = { title: "AgentSolver · Acceso por invitación" };

// Pantalla para quien ha iniciado sesión pero no tiene invitación: la herramienta es solo para clubes
// seleccionados. Si ya tiene acceso (o se lo acaban de dar) vuelve al resumen.
export default async function Access() {
  const user = await requireUser();
  if (await getWorkspaceContext()) redirect("/");
  const contact = process.env.ACCESS_CONTACT_EMAIL;
  return <main className="grid min-h-dvh place-items-center px-4"><div className="max-w-md text-center">
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">acceso por invitación</p>
    <h1 className="editorial-heading mt-3 text-3xl">Todavía no tienes acceso</h1>
    <p className="mt-3 text-sm text-muted-foreground">AgentSolver es solo para clubes seleccionados. Has entrado como <strong className="text-foreground">{user.email}</strong>, pero ese email no tiene ninguna invitación.</p>
    <p className="mt-2 text-sm text-muted-foreground">{contact ? <>Pide acceso a <a className="underline underline-offset-4" href={`mailto:${contact}`}>{contact}</a> indicando tu club y este email.</> : "Pide acceso a quien gestiona la herramienta indicando tu club y este email."}</p>
    <form action="/api/auth/logout" method="post" className="mt-6"><Button type="submit" variant="outline">Cerrar sesión</Button></form>
  </div></main>;
}
