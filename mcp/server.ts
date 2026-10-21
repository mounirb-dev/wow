// AgentSolver MCP server.
// Local mode: bun --env-file=.env.local mcp/server.ts
// Remote HTTPS/OAuth mode is intentionally kept separate from the stdio entrypoint.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadPlayers } from "../lib/data.js";
import { curve, leverage, monthsLeft, portfolio } from "../lib/tools.js";

type Player = Awaited<ReturnType<typeof loadPlayers>>[number];
type ToolResult = { content: [{ type: "text"; text: string }] };

const server = new McpServer({ name: "agentsolver", version: "0.3.0" });

const text = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

const error = (message: string, details: Record<string, unknown> = {}): ToolResult =>
  text({ error: message, ...details });

const findPlayer = async (playerId: string): Promise<Player | undefined> =>
  (await loadPlayers()).find((player) => player.id === playerId);

server.tool("list_clients", "List the agent's players", {}, async () => {
  const players = await loadPlayers();
  return text(players.map(({ suitors: _suitors, ...player }) => player));
});

server.tool("portfolio_summary", "Portfolio value, expiring contracts and expected commission", {}, async () =>
  text(portfolio(await loadPlayers()))
);

server.tool(
  "valuation",
  "Valuation, contract months left and leverage for a player",
  { playerId: z.string().min(1) },
  async ({ playerId }) => {
    const player = await findPlayer(playerId);
    return player
      ? text({ ...player, monthsLeft: monthsLeft(player), leverage: leverage(player) })
      : error("Player not found", { playerId });
  },
);

server.tool(
  "negotiation_brief",
  "Optimal ask and expected commission against the best suitor",
  { playerId: z.string().min(1), club: z.string().optional() },
  async ({ playerId, club }) => {
    const player = await findPlayer(playerId);
    if (!player) return error("Player not found", { playerId });

    const suitor = player.suitors.find(({ club: name }) => name === club)
      ?? [...player.suitors].sort((a, b) => b.need - a.need)[0];
    if (!suitor) return error("Player has no interested clubs", { playerId });

    const { best } = curve(player, suitor);
    return text({
      player: player.name,
      club: suitor.club,
      optimalAskM: Number(best.ask.toFixed(2)),
      dealProbability: Number(best.pDeal.toFixed(2)),
      expectedCommissionM: Number(best.ev.toFixed(3)),
    });
  },
);

await server.connect(new StdioServerTransport());
