import { notFound } from "next/navigation";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import PlayerProfile from "@/components/PlayerProfile.jsx";
import { loadPlayer } from "@/lib/data.js";
import { requireUser } from "@/lib/session.js";
import { canEdit, getWorkspaceContext } from "@/lib/workspace.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const player = await loadPlayer(id);
  return { title: player ? `AgentSolver · ${player.name}` : "AgentSolver · Jugador" };
}

export default async function PlayerPage({ params }) {
  await requireUser();
  const { id } = await params;
  const [player, context] = await Promise.all([loadPlayer(id), getWorkspaceContext()]);
  if (!player) notFound();
  return <WorkspaceShell><PlayerProfile player={player} canDelete={Boolean(canEdit(context?.member))} /></WorkspaceShell>;
}
