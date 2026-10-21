import { cache } from "react";
import { Query } from "node-appwrite";
import { listAll } from "./appwrite.js";
import { getWorkspaceContext } from "./workspace.js";

// Two workspace-scoped queries for the whole roster instead of two per player.
export const loadStaffDataByPlayer = cache(async () => {
  const context = await getWorkspaceContext();
  if (!context) return {};
  const scope = [Query.equal("workspaceId", context.workspace.$id)];
  const [signals, targets] = await Promise.all([
    listAll(context.db, "player_staff_signals", scope),
    listAll(context.db, "transfer_targets", [...scope, Query.orderDesc("createdAt")]),
  ]);
  const byPlayer = {};
  const slot = (id) => (byPlayer[id] ??= { signals: [], targets: [] });
  for (const row of signals) slot(row.playerId).signals.push(row);
  for (const row of targets) slot(row.playerId).targets.push(row);
  return byPlayer;
});

export async function loadPlayerStaffData(playerId) {
  return (await loadStaffDataByPlayer())[playerId] ?? { signals: [], targets: [] };
}
