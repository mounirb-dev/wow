import { cache } from "react";
import { Query } from "node-appwrite";
import { listAll } from "./appwrite.js";
import { getWorkspaceContext } from "./workspace.js";

// Valoraciones del staff (player_staff_signals) y movimientos propuestos (transfer_targets)
// de TODA la plantilla, agrupados por playerId: { [playerId]: { signals, targets } }.
// Dos consultas en total en vez de dos por jugador (evita el N+1 del tablero de negociaciones).
// Un jugador sin datos no aparece en el mapa: quien lo use debe dar un valor por defecto.
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

// Atajo para un solo jugador; reutiliza la carga cacheada de la plantilla entera.
export async function loadPlayerStaffData(playerId) {
  return (await loadStaffDataByPlayer())[playerId] ?? { signals: [], targets: [] };
}
