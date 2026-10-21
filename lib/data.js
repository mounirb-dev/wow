import { Query, TablesDB } from "node-appwrite";
import { adminClient, DB } from "./appwrite.js";
import { getWorkspaceContext } from "./workspace.js";

export async function loadPlayersFromDb() {
  const context = await getWorkspaceContext();
  if (!context) return [];
  const db = new TablesDB(adminClient());
  const [{ rows: players }, { rows: suitors }] = await Promise.all([
    db.listRows(DB, "players", [Query.equal("workspaceId", context.workspace.$id), Query.limit(100)]),
    db.listRows(DB, "suitors", [Query.limit(500)]),
  ]);
  return players.map((p) => ({
    id: p.$id, name: p.name, age: p.age, pos: p.pos, club: p.club,
    contractEnd: p.contractEnd, value: p.value, salary: p.salary, fair: p.fair,
    momentum: p.momentum, seed: p.seed, minutes: p.minutes ?? null, goals: p.goals ?? null,
    assists: p.assists ?? null, progressiveActions: p.progressiveActions ?? null, role: p.role ?? null,
    staffNotes: p.staffNotes ?? null, tacticalFit: p.tacticalFit ?? null, availability: p.availability ?? null,
    adaptationRisk: p.adaptationRisk ?? null, sourceUrl: p.sourceUrl ?? null, dataStatus: p.dataStatus ?? "pending",
    suitors: suitors.filter((s) => s.playerId === p.$id).map((s) => ({ club: s.club, need: s.need })),
  }));
}

export async function loadPlayers() { return loadPlayersFromDb(); }
