import { cache } from "react";
import { Query } from "node-appwrite";
import { DB, chunk, listAll } from "./appwrite.js";
import { getWorkspaceContext } from "./workspace.js";

// Fila de Appwrite -> objeto de dominio que consumen la UI, lib/tools.js y el MCP.
// Los campos opcionales se normalizan a null para que la UI distinga "sin dato" de 0.
const toPlayer = (p, suitors) => ({
  id: p.$id, name: p.name, age: p.age, pos: p.pos, club: p.club,
  contractEnd: p.contractEnd, value: p.value, salary: p.salary, fair: p.fair,
  momentum: p.momentum, seed: p.seed, minutes: p.minutes ?? null, goals: p.goals ?? null,
  assists: p.assists ?? null, progressiveActions: p.progressiveActions ?? null, role: p.role ?? null,
  staffNotes: p.staffNotes ?? null, tacticalFit: p.tacticalFit ?? null, availability: p.availability ?? null,
  adaptationRisk: p.adaptationRisk ?? null, sourceUrl: p.sourceUrl ?? null, dataStatus: p.dataStatus ?? "pending",
  suitors: suitors.filter((s) => s.playerId === p.$id).map((s) => ({ club: s.club, need: s.need })),
});

// Suitors are fetched only for this workspace's players (Appwrite allows 100 values per equal()).
async function loadSuitors(db, playerIds) {
  const pages = await Promise.all(chunk(playerIds).map((ids) => listAll(db, "suitors", [Query.equal("playerId", ids)])));
  return pages.flat();
}

// Todos los jugadores del workspace actual, con sus pretendientes. cache(): páginas,
// generateMetadata y componentes anidados comparten una sola carga por petición.
export const loadPlayers = cache(async () => {
  const context = await getWorkspaceContext();
  if (!context) return [];
  const players = await listAll(context.db, "players", [Query.equal("workspaceId", context.workspace.$id), Query.orderAsc("name")]);
  const suitors = await loadSuitors(context.db, players.map((p) => p.$id));
  return players.map((p) => toPlayer(p, suitors));
});

// Un jugador por id (null si no existe o es de otro workspace). Lee solo esa fila en vez de
// toda la plantilla.
export const loadPlayer = cache(async (id) => {
  const context = await getWorkspaceContext();
  if (!context) return null;
  const row = await context.db.getRow(DB, "players", id).catch((error) => { if (error.code === 404) return null; throw error; });
  if (!row || row.workspaceId !== context.workspace.$id) return null;
  return toPlayer(row, await loadSuitors(context.db, [row.$id]));
});
