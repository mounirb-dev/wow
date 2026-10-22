// Alta y baja de jugadores de un workspace. Lo comparten la API (/api/players) y el MCP, así que
// las reglas viven aquí una sola vez: rol editor+, validación, sin duplicados y borrado en
// cascada. Toda lectura/escritura filtra por workspace (docs/arquitectura.md).
import { ID, Query } from "node-appwrite";
import { DB, listAll } from "./appwrite.js";
import { mapLimit } from "./async.js";
import { revalidateNewsCache, revalidatePlayersCache } from "./cache-tags.js";
import { parsePlayerInput, playerKey } from "./player-input.js";
import { canEdit } from "./workspace.js";

// Error con el código HTTP que debe devolver quien lo capture (API) o el mensaje que verá el agente (MCP).
export class PlayerError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "PlayerError";
    this.status = status;
  }
}

// Tablas con filas colgando de un jugador. Las dos últimas tienen índice (workspaceId, playerId),
// así que se consultan con ambos campos.
const RELATED = [
  { table: "suitors", scoped: false },
  { table: "news_items", scoped: false },
  { table: "player_staff_signals", scoped: true },
  { table: "transfer_targets", scoped: true },
];

function requireEditor(context) {
  if (!canEdit(context.member)) throw new PlayerError("Tu rol solo permite consultar", 403);
}

export async function createPlayer(context, body) {
  requireEditor(context);
  const { data, error } = parsePlayerInput(body);
  if (error) throw new PlayerError(error, 400);

  const workspaceId = context.workspace.$id;
  const existing = await listAll(context.db, "players", [Query.equal("workspaceId", workspaceId)]);
  const key = playerKey(data.name, data.club);
  if (existing.some((player) => playerKey(player.name, player.club) === key)) throw new PlayerError("Ya tienes un jugador con ese nombre y club", 409);

  // Los campos económicos y de rendimiento quedan vacíos: nunca se inventan (ver lib/coach.js).
  const row = await context.db.createRow(DB, "players", ID.unique(), { ...data, workspaceId, value: 0, salary: 0, fair: 0, momentum: 0.5, seed: 0, dataStatus: "manual" });
  revalidatePlayersCache();
  return row;
}

// Borra el jugador y TODO lo que cuelga de él (pretendientes, noticias, señales y objetivos del
// staff). Primero los hijos y al final el jugador: si algo falla a medias, el jugador sigue
// existiendo y se puede reintentar sin dejar huérfanos.
export async function deletePlayer(context, id) {
  requireEditor(context);
  const workspaceId = context.workspace.$id;
  const row = await context.db.getRow(DB, "players", id).catch((error) => { if (error.code === 404) return null; throw error; });
  // Jugador ajeno e inexistente responden igual (404) para no revelar ids de otros workspaces.
  if (!row || row.workspaceId !== workspaceId) throw new PlayerError("Jugador no encontrado", 404);

  await Promise.all(RELATED.map(async ({ table, scoped }) => {
    const queries = [...(scoped ? [Query.equal("workspaceId", workspaceId)] : []), Query.equal("playerId", id)];
    const children = await listAll(context.db, table, queries);
    await mapLimit(children, 10, (child) => context.db.deleteRow(DB, table, child.$id));
  }));
  await context.db.deleteRow(DB, "players", id);
  revalidatePlayersCache();
  revalidateNewsCache([id]);
  return row;
}
