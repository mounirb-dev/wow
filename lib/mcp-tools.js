// Herramientas MCP de AgentSolver. `loadPlayers` y las funciones de escritura se inyectan: en producción
// actúan sobre el workspace del usuario autenticado; en los tests son dobles. Las herramientas de escritura
// solo se registran si se inyecta su función (el token debe tener permiso de edición) y respetan el rol del
// usuario (un viewer no puede añadir, editar ni borrar).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DEFAULT_WEIGHTS, FORMATIONS, GROUPS, decisionMatrix, playerReport, positionGroup, squadAlerts, squadBalance, suggestLineup } from "./coach.js";
import { curve, leverage, monthsLeft, portfolio } from "./tools.js";

const text = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const failure = (message, details = {}) => ({ isError: true, ...text({ error: message, ...details }) });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const additive = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const destructive = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

// Los errores previstos de lib/player-store.js (rol, validación, duplicado, no existe) llegan al
// agente como resultado de herramienta con isError; cualquier otro se propaga como fallo real.
async function writing(action) {
  try {
    return await action();
  } catch (error) {
    if (error?.name === "PlayerError") return failure(error.message, { status: error.status });
    throw error;
  }
}

// Datos que se pueden escribir en un jugador (todo opcional; null borra el dato). Dinero en millones.
const nullableCount = z.number().int().nullable().optional();
const nullableText = (max) => z.string().max(max).nullable().optional();
const PLAYER_EDIT = {
  name: z.string().min(1).max(120).optional(),
  club: z.string().min(1).max(120).optional(),
  pos: z.string().min(1).max(16).optional(),
  age: z.number().int().min(14).max(50).optional(),
  contractEnd: z.string().min(8).max(40).optional(),
  value: z.number().min(0).max(10000).optional(),
  salary: z.number().min(0).max(10000).optional(),
  fair: z.number().min(0).max(10000).optional(),
  minutes: nullableCount,
  goals: nullableCount,
  assists: nullableCount,
  progressiveActions: nullableCount,
  tacticalFit: nullableCount,
  availability: nullableCount,
  adaptationRisk: nullableCount,
  role: nullableText(120),
  staffNotes: nullableText(4000),
  phone: nullableText(30),
  email: nullableText(255),
  location: nullableText(120),
  agentName: nullableText(120),
  agentPhone: nullableText(30),
  sourceUrl: nullableText(500),
};

export function createMcpServer({ loadPlayers, addPlayer, removePlayer, updatePlayer, saveOpinion, addSuitor, removeSuitor }) {
  const server = new McpServer({ name: "agentsolver", version: "1.0.0" });
  const findPlayer = async (playerId) => (await loadPlayers()).find((player) => player.id === playerId);

  server.registerTool("list_clients", { description: "List the agent's players", annotations: readOnly }, async () => {
    const players = await loadPlayers();
    return text(players.map(({ suitors: _suitors, ...player }) => player));
  });

  server.registerTool("portfolio_summary", { description: "Portfolio value, expiring contracts and expected commission", annotations: readOnly }, async () => text(portfolio(await loadPlayers())));

  server.registerTool("valuation", { description: "Valuation, contract months left and leverage for a player", inputSchema: { playerId: z.string().min(1) }, annotations: readOnly }, async ({ playerId }) => {
    const player = await findPlayer(playerId);
    return player ? text({ ...player, monthsLeft: monthsLeft(player), leverage: leverage(player) }) : failure("Player not found", { playerId });
  });

  server.registerTool("negotiation_brief", { description: "Optimal ask and expected commission against the best suitor", inputSchema: { playerId: z.string().min(1), club: z.string().optional() }, annotations: readOnly }, async ({ playerId, club }) => {
    const player = await findPlayer(playerId);
    if (!player) return failure("Player not found", { playerId });
    const suitor = player.suitors.find(({ club: name }) => name === club) ?? [...player.suitors].sort((a, b) => b.need - a.need)[0];
    if (!suitor) return failure("Player has no interested clubs", { playerId });
    const { best } = curve(player, suitor);
    return text({ player: player.name, club: suitor.club, optimalAskM: Number(best.ask.toFixed(2)), dealProbability: Number(best.pDeal.toFixed(2)), expectedCommissionM: Number(best.ev.toFixed(3)) });
  });

  // --- Herramientas para el cuerpo técnico (lib/coach.js). Nunca inventan datos: lo que falta se informa. ---

  server.registerTool("squad_alerts", { description: "Prioritised alerts for the coaching staff: expiring contracts, low availability, thin positions, missing ratings", annotations: readOnly }, async () => text(squadAlerts(await loadPlayers())));

  server.registerTool("squad_balance", { description: "Squad depth by line (GK/DF/MF/FW), average age, expiring contracts and how much real data backs the analysis", annotations: readOnly }, async () => text(squadBalance(await loadPlayers())));

  server.registerTool("lineup_suggestion", { description: "Suggested starting XI for a formation using the staff's technical ratings; unrated players are placed after rated ones", inputSchema: { formation: z.enum(Object.keys(FORMATIONS)).optional() }, annotations: readOnly }, async ({ formation }) => {
    const players = await loadPlayers();
    const names = new Map(players.map((player) => [player.id, player.name]));
    const lineup = suggestLineup(players, formation);
    return text({ formation: lineup.formation, starters: lineup.slots.map(({ group, playerId }) => ({ line: group, player: playerId ? names.get(playerId) : null, playerId })), bench: lineup.bench.map((id) => names.get(id)), warnings: lineup.warnings });
  });

  server.registerTool("decision_matrix", {
    description: "Rank players with a weighted multi-criteria score. Weights are 0-5 per criterion (tacticalFit, availability, adaptation, goals90, assists90, progressive90, age, contract). Missing data is excluded and reported as coverage, never invented. A player with data for less than 50% of the weighted criteria gets score null and a provisionalScore with a note (reliable: false): it is not comparable and is listed after the reliable ones",
    inputSchema: { weights: z.record(z.string(), z.number()).optional(), line: z.enum(GROUPS).optional() },
    annotations: readOnly,
  }, async ({ weights, line }) => {
    const players = (await loadPlayers()).filter((player) => !line || positionGroup(player.pos) === line);
    return text({ weights: { ...DEFAULT_WEIGHTS, ...weights }, ranking: decisionMatrix(players, { ...DEFAULT_WEIGHTS, ...weights }) });
  });

  server.registerTool("player_report", { description: "Technical report for one player: recommendation with reasons, per-90 stats when the sample is reliable, alerts and missing data", inputSchema: { playerId: z.string().min(1) }, annotations: readOnly }, async ({ playerId }) => {
    const player = await findPlayer(playerId);
    return player ? text(playerReport(player)) : failure("Player not found", { playerId });
  });

  // --- Escritura. Solo se registran si el entorno las inyecta. ---

  if (addPlayer) {
    server.registerTool("add_player", {
      description: "Add a player to the agent's workspace. Needs name, club, position (GK, DF, MF or FW; aliases like CB or ST are accepted), age (14-50) and contract end date (YYYY-MM-DD). Economic and performance data are left empty, never invented. Fails if a player with the same name and club already exists",
      inputSchema: { name: z.string().min(1).max(120), club: z.string().min(1).max(120), pos: z.string().min(1).max(16), age: z.number().int().min(14).max(50), contractEnd: z.string().min(8).max(40) },
      annotations: additive,
    }, async (input) => writing(async () => {
      const row = await addPlayer(input);
      return text({ added: { id: row.$id, name: row.name, club: row.club, pos: row.pos, age: row.age, contractEnd: row.contractEnd } });
    }));
  }

  if (updatePlayer) {
    server.registerTool("update_player", {
      description: "Edit a player's data. Pass only the fields to change; null clears an optional field. Money (value, salary, fair) is in millions. Staff ratings tacticalFit, availability and adaptationRisk are 0-100 integers; minutes, goals, assists and progressiveActions are whole numbers. These fields feed the squad analytics (decision_matrix, player_report, lineup_suggestion). Only write values the user gave you or that come from a verified source: never estimate or invent data",
      inputSchema: { playerId: z.string().min(1), ...PLAYER_EDIT },
      annotations: additive,
    }, async ({ playerId, ...fields }) => writing(async () => {
      const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
      if (!Object.keys(changes).length) return failure("Pass at least one field to change", { playerId });
      const row = await updatePlayer(playerId, changes);
      return text({ updated: { id: playerId, name: row.name, club: row.club, ...Object.fromEntries(Object.keys(changes).map((field) => [field, row[field] ?? null])) } });
    }));
  }

  if (saveOpinion) {
    server.registerTool("save_staff_opinion", {
      description: "Save the connected user's own opinion on a player: interested, not-interested or pending, plus an optional note (up to 4000 characters). There is one opinion per player and user: saving again replaces it. It is always written under the connected user's name",
      inputSchema: { playerId: z.string().min(1), interest: z.enum(["interested", "not-interested", "pending"]), notes: z.string().max(4000).optional() },
      annotations: { ...additive, idempotentHint: true },
    }, async ({ playerId, interest, notes }) => writing(async () => {
      const row = await saveOpinion(playerId, { interest, notes });
      return text({ saved: { playerId, interest: row.interest, notes: row.notes ?? null, author: row.userName } });
    }));
  }

  if (addSuitor) {
    server.registerTool("add_suitor", {
      description: "Record that a club is interested in a player, with how much it needs him (0-100). If the club was already listed its need is updated. negotiation_brief and the portfolio pipeline use these clubs",
      inputSchema: { playerId: z.string().min(1), club: z.string().min(1).max(120), need: z.number().int().min(0).max(100) },
      annotations: { ...additive, idempotentHint: true },
    }, async ({ playerId, club, need }) => writing(async () => {
      const { row, updated } = await addSuitor(playerId, { club, need });
      return text({ suitor: { playerId, club: row.club, need: row.need, updated } });
    }));
  }

  if (removeSuitor) {
    server.registerTool("remove_suitor", {
      description: "Remove a club from a player's interested clubs. Only call it when the user asked to remove that club",
      inputSchema: { playerId: z.string().min(1), club: z.string().min(1).max(120) },
      annotations: destructive,
    }, async ({ playerId, club }) => writing(async () => {
      const row = await removeSuitor(playerId, club);
      return text({ removed: { playerId, club: row.club } });
    }));
  }

  if (removePlayer) {
    server.registerTool("delete_player", {
      description: "Permanently delete a player and everything attached to them (interested clubs, news, staff signals and transfer targets). It cannot be undone: only call it when the user explicitly asked to delete this player, and pass confirm: true",
      inputSchema: { playerId: z.string().min(1), confirm: z.literal(true) },
      annotations: destructive,
    }, async ({ playerId }) => writing(async () => {
      const row = await removePlayer(playerId);
      return text({ deleted: { id: playerId, name: row.name, club: row.club } });
    }));
  }

  return server;
}
