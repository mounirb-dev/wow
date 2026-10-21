// Herramientas MCP de AgentSolver (solo lectura). `loadPlayers` se inyecta: en producción carga
// los jugadores del workspace del usuario autenticado; en los tests devuelve datos de prueba.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { curve, leverage, monthsLeft, portfolio } from "./tools.js";

const text = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const failure = (message, details = {}) => ({ isError: true, ...text({ error: message, ...details }) });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function createMcpServer({ loadPlayers }) {
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

  return server;
}
