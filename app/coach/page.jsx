import PageHeader from "@/components/PageHeader.jsx";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import AlertsPanel from "@/components/coach/AlertsPanel.jsx";
import BalancePanel from "@/components/coach/BalancePanel.jsx";
import DecisionMatrix from "@/components/coach/DecisionMatrix.jsx";
import LineupBuilder from "@/components/coach/LineupBuilder.jsx";
import { squadAlerts, squadBalance } from "@/lib/coach.js";
import { loadPlayers } from "@/lib/data.js";
import { requireUser } from "@/lib/session.js";

export const metadata = { title: "AgentSolver · Cuerpo técnico" };
export const dynamic = "force-dynamic";

// Panel del cuerpo técnico: alertas, equilibrio de plantilla, alineación y matriz de decisión.
// Todo se calcula con los datos reales del workspace (lib/coach.js); lo que falta se marca, no se inventa.
export default async function CoachPage() {
  await requireUser();
  const players = await loadPlayers();

  return <WorkspaceShell><main className="min-h-screen space-y-6 px-2 py-5">
    <PageHeader showBack={false} eyebrow="staff" title="Cuerpo técnico" description="Herramientas para decidir con datos: qué revisar, cómo está equilibrada la plantilla, quién alinear y a quién priorizar." />
    {players.length === 0
      ? <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Todavía no hay jugadores en este workspace. Cuando los haya, aquí aparecerán las alertas, la alineación y la matriz de decisión.</p>
      : <>
        <AlertsPanel alerts={squadAlerts(players)} />
        <BalancePanel balance={squadBalance(players)} />
        <LineupBuilder players={players} />
        <DecisionMatrix players={players} />
      </>}
  </main></WorkspaceShell>;
}
