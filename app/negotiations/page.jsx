import PageHeader from "@/components/PageHeader.jsx";
import { loadPlayers } from "@/lib/data.js";
import { leverage } from "@/lib/tools.js";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import NegotiationKanban from "@/components/NegotiationKanban.jsx";
import { loadPlayerStaffData } from "@/lib/staff-data.js";

export const metadata = { title: "AgentSolver · Negociaciones" };
export const dynamic = "force-dynamic";

export default async function NegotiationsPage({ searchParams }) {
  const params = await searchParams;
  const players = await loadPlayers();
  // Aunque no haya una alerta contractual, el staff debe poder valorar y
  // proponer movimientos sobre cualquier jugador de la cartera.
  const opportunities = [...players].sort((a, b) => leverage(b) - leverage(a));
  const staffData = await Promise.all(opportunities.map(async (player) => [player.id, await loadPlayerStaffData(player.id)]));
  const dataByPlayer = Object.fromEntries(staffData);
  return <WorkspaceShell><main className="min-h-screen px-2 py-5"><PageHeader eyebrow="pipeline" title="Negociaciones" description="Mueve jugadores entre estados y registra el criterio del staff." /><NegotiationKanban players={opportunities} staffData={dataByPlayer} initialPlayerId={typeof params?.player === "string" ? params.player : null} /></main></WorkspaceShell>;
}
