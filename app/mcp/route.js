// /mcp — endpoint MCP remoto (Streamable HTTP) para conectar Claude u otros clientes por URL.
// Se autentica con el token OAuth emitido por /api/mcp/oauth/* y solo ve el workspace de ese
// usuario. Ver lib/mcp-http.js (protocolo) y lib/mcp-oauth.js (autenticación).
import { handleMcpRequest } from "@/lib/mcp-http.js";
import { userFromAuthorization } from "@/lib/mcp-oauth.js";
import { loadPlayersFor } from "@/lib/data.js";
import { createPlayer, deletePlayer } from "@/lib/player-store.js";
import { resolveWorkspaceContext } from "@/lib/workspace.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sin invitación no hay workspace (acceso solo para clubes seleccionados): la herramienta falla en vez de
// leer o escribir datos de nadie.
async function contextOf(user) {
  const context = await resolveWorkspaceContext(user);
  if (!context) throw new Error("Esta cuenta no tiene acceso a AgentSolver: hace falta una invitación.");
  return context;
}

const handle = (request) => handleMcpRequest(request, {
  authenticate: (req) => userFromAuthorization(req.headers.get("authorization")),
  loadPlayers: async (user) => loadPlayersFor(await contextOf(user)),
  addPlayer: async (user, input) => createPlayer(await contextOf(user), input),
  removePlayer: async (user, playerId) => deletePlayer(await contextOf(user), playerId),
});

export { handle as GET, handle as POST, handle as DELETE };
