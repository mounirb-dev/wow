import { notFound } from "next/navigation";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import PlayerProfile from "@/components/PlayerProfile.jsx";
import { loadPlayers } from "@/lib/data.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const player = (await loadPlayers()).find((item) => item.id === id);
  return { title: player ? `AgentSolver · ${player.name}` : "AgentSolver · Jugador" };
}

export default async function PlayerPage({ params }) {
  const { id } = await params;
  const player = (await loadPlayers()).find((item) => item.id === id);
  if (!player) notFound();
  return <WorkspaceShell><PlayerProfile player={player} /></WorkspaceShell>;
}
