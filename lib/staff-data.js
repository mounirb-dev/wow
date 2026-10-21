import { Query, TablesDB } from "node-appwrite";
import { adminClient, DB } from "./appwrite.js";
import { getWorkspaceContext } from "./workspace.js";

export async function loadPlayerStaffData(playerId) {
  const context = await getWorkspaceContext();
  if (!context) return { signals: [], targets: [] };
  const db = new TablesDB(adminClient());
  const [{ rows: signals }, { rows: targets }] = await Promise.all([
    db.listRows(DB, "player_staff_signals", [Query.equal("workspaceId", context.workspace.$id), Query.equal("playerId", playerId), Query.limit(100)]),
    db.listRows(DB, "transfer_targets", [Query.equal("workspaceId", context.workspace.$id), Query.equal("playerId", playerId), Query.orderDesc("createdAt"), Query.limit(100)]),
  ]);
  return { signals, targets };
}
