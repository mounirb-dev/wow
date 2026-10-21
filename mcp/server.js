// AgentSolver MCP server (stdio). Run: bun --env-file=.env.local mcp/server.js
// Same data (Appwrite/PostgreSQL) and maths (lib/tools.js) as the web terminal.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadPlayers } from "../lib/data.js";
import { curve, leverage, monthsLeft, portfolio } from "../lib/tools.js";

const server = new McpServer({ name: "agentsolver", version: "0.2.0" });
const text = (o) => ({ content: [{ type: "text", text: JSON.stringify(o, null, 2) }] });
const find = async (id) => (await loadPlayers()).find((p) => p.id === id);

server.tool("list_clients", "List the agent's players", {}, async () => text((await loadPlayers()).map(({ suitors, ...p }) => p)));
server.tool("portfolio_summary", "Portfolio value, expiring contracts and expected commission", {}, async () => text(portfolio(await loadPlayers())));
server.tool("valuation", "Valuation, contract months left and leverage for a player", { playerId: z.string() }, async ({ playerId }) => {
  const p = await find(playerId);
  return text(p ? { ...p, monthsLeft: monthsLeft(p), leverage: leverage(p) } : { error: "not found" });
});
server.tool("negotiation_brief", "Optimal ask and expected commission against the best suitor", { playerId: z.string(), club: z.string().optional() }, async ({ playerId, club }) => {
  const p = await find(playerId);
  if (!p) return text({ error: "not found" });
  const suitor = p.suitors.find((s) => s.club === club) ?? [...p.suitors].sort((a, b) => b.need - a.need)[0];
  const { best } = curve(p, suitor);
  return text({ player: p.name, club: suitor.club, optimalAskM: +best.ask.toFixed(2), dealProbability: +best.pDeal.toFixed(2), expectedCommissionM: +best.ev.toFixed(3) });
});

await server.connect(new StdioServerTransport());
