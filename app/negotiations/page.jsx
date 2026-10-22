import PageHeader from "@/components/PageHeader.jsx";
import { loadPlayers } from "@/lib/data.js";
import { leverage } from "@/lib/tools.js";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import NegotiationKanban from "@/components/NegotiationKanban.jsx";
import { loadStaffDataByPlayer } from "@/lib/staff-data.js";
import { requireUser } from "@/lib/session.js";

export const metadata = { title: "AgentSolver · Negociaciones" };
export const dynamic = "force-dynamic";

export default async function NegotiationsPage({ searchParams }) {
  const user = await requireUser();
  const [params, players, staffByPlayer] = await Promise.all([searchParams, loadPlayers(), loadStaffDataByPlayer()]);
  // Aunque no haya una alerta contractual, el staff debe poder valorar y
  // proponer movimientos sobre cualquier jugador de la cartera.
  const opportunities = [...players].sort((a, b) => leverage(b) - leverage(a));
  const dataByPlayer = Object.fromEntries(opportunities.map((player) => [player.id, staffByPlayer[player.id] ?? { signals: [], targets: [] }]));
  return <WorkspaceShell><main className="min-h-screen px-2 py-5"><PageHeader eyebrow="pipeline" title="Negociaciones" description="Mueve jugadores entre estados y registra el criterio del staff." /><NegotiationKanban players={opportunities} staffData={dataByPlayer} initialPlayerId={typeof params?.player === "string" ? params.player : null} userId={user.$id} /></main></WorkspaceShell>;
}
