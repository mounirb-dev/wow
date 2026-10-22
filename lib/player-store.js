// Alta, edición y baja de jugadores de un workspace, más la opinión del staff y los clubes interesados. Lo
// comparten la API (/api/players…) y el MCP, así que las reglas viven aquí una sola vez: rol editor+,
// validación, sin duplicados y borrado en cascada. Toda lectura/escritura filtra por workspace (docs/arquitectura.md).
import { createHash } from "node:crypto";
import { ID, Query } from "node-appwrite";
import { DB, listAll } from "./appwrite.js";
import { mapLimit } from "./async.js";
import { revalidateNewsCache, revalidatePlayersCache } from "./cache-tags.js";
import { parsePlayerInput, parsePlayerPatch, playerKey } from "./player-input.js";
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

// Jugador de ESTE workspace o 404 (uno ajeno y uno inexistente responden igual para no revelar ids de otros).
async function ownPlayer(context, id) {
  const row = await context.db.getRow(DB, "players", id).catch((error) => { if (error.code === 404) return null; throw error; });
  if (!row || row.workspaceId !== context.workspace.$id) throw new PlayerError("Jugador no encontrado", 404);
  return row;
}

// Datos de rendimiento y valoración del staff: enteros con su tope (minutos y acciones hasta 100000; la
// valoración, 0-100). Vacío o null borra el dato. Un valor no válido es un error, no se ignora en silencio.
const COUNT_LIMITS = { minutes: 100000, goals: 100000, assists: 100000, progressiveActions: 100000, tacticalFit: 100, availability: 100, adaptationRisk: 100 };
const TEXT_FIELDS = ["role", "staffNotes"];

// Edita un jugador (editor+): datos básicos, económicos, de contacto, rendimiento y valoración técnica. Cada
// campo presente se valida; los que faltan no se tocan. Si algo es inválido no se guarda NADA.
export async function updatePlayer(context, id, body) {
  requireEditor(context);
  const player = await ownPlayer(context, id);
  const edit = parsePlayerPatch(body);
  if (edit.error) throw new PlayerError(edit.error, 400);
  const data = { ...edit.data };
  for (const [field, limit] of Object.entries(COUNT_LIMITS)) {
    if (!Object.hasOwn(body ?? {}, field)) continue;
    const value = body[field];
    if (value === "" || value === null) { data[field] = null; continue; }
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > limit) throw new PlayerError(`${field} debe ser un entero entre 0 y ${limit}`, 400);
    data[field] = number;
  }
  for (const field of TEXT_FIELDS) if (Object.hasOwn(body ?? {}, field)) data[field] = String(body[field] ?? "").trim() || null;
  if (!Object.keys(data).length) throw new PlayerError("Sin cambios válidos", 400);
  if (data.name !== undefined || data.club !== undefined) {
    // Renombrar o cambiar de club no puede dejar dos jugadores iguales (mismo nombre y club).
    const key = playerKey(data.name ?? player.name, data.club ?? player.club);
    const others = await listAll(context.db, "players", [Query.equal("workspaceId", context.workspace.$id)]);
    if (others.some((other) => other.$id !== id && playerKey(other.name, other.club) === key)) throw new PlayerError("Ya tienes un jugador con ese nombre y club", 409);
  }
  const row = await context.db.updateRow(DB, "players", id, data);
  revalidatePlayersCache();
  return row;
}

const INTERESTS = new Set(["interested", "not-interested", "pending"]);

// Guarda (crea o actualiza) la opinión del usuario actual sobre un jugador: una fila por (jugador, usuario).
// Es SIEMPRE la del usuario que actúa (también por MCP): no se puede escribir en nombre de otro.
export async function saveStaffSignal(context, playerId, { interest, notes } = {}) {
  requireEditor(context);
  await ownPlayer(context, playerId);
  const rowId = `signal_${createHash("sha256").update(`${playerId}:${context.user.$id}`).digest("hex").slice(0, 29)}`;
  const data = { workspaceId: context.workspace.$id, playerId, userId: context.user.$id, userName: context.user.name || context.user.email, interest: INTERESTS.has(interest) ? interest : "pending", notes: String(notes ?? "").trim().slice(0, 4000) || null, updatedAt: new Date().toISOString() };
  try { return await context.db.updateRow(DB, "player_staff_signals", rowId, data); }
  catch (error) {
    if (error.code !== 404) throw error;
    return context.db.createRow(DB, "player_staff_signals", rowId, data);
  }
}

// Clubes interesados en un jugador (tabla `suitors`, sin workspace propio: se cuelgan de un jugador ya
// comprobado). `need` = 0-100. Si el club ya estaba (sin importar mayúsculas ni tildes) se actualiza su
// necesidad en vez de duplicarlo.
const findSuitor = async (context, playerId, club) => (await listAll(context.db, "suitors", [Query.equal("playerId", playerId)])).find((row) => playerKey(row.club, "") === playerKey(club, ""));

export async function addSuitor(context, playerId, { club, need }) {
  requireEditor(context);
  await ownPlayer(context, playerId);
  const name = String(club ?? "").trim();
  const level = need === null || need === undefined || need === "" ? NaN : Number(need);
  if (!name || name.length > 120) throw new PlayerError("El club es obligatorio (máximo 120 caracteres)", 400);
  if (!Number.isInteger(level) || level < 0 || level > 100) throw new PlayerError("La necesidad debe ser un entero entre 0 y 100", 400);
  const existing = await findSuitor(context, playerId, name);
  const row = existing ? await context.db.updateRow(DB, "suitors", existing.$id, { need: level }) : await context.db.createRow(DB, "suitors", ID.unique(), { playerId, club: name, need: level });
  revalidatePlayersCache();
  return { row, updated: Boolean(existing) };
}

export async function removeSuitor(context, playerId, club) {
  requireEditor(context);
  await ownPlayer(context, playerId);
  const existing = await findSuitor(context, playerId, club);
  if (!existing) throw new PlayerError("Ese club no está entre los interesados", 404);
  await context.db.deleteRow(DB, "suitors", existing.$id);
  revalidatePlayersCache();
  return existing;
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
