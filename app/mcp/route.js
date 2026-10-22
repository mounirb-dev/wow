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

const handle = (request) => handleMcpRequest(request, {
  authenticate: (req) => userFromAuthorization(req.headers.get("authorization")),
  loadPlayers: async (user) => loadPlayersFor(await resolveWorkspaceContext(user)),
  addPlayer: async (user, input) => createPlayer(await resolveWorkspaceContext(user), input),
  removePlayer: async (user, playerId) => deletePlayer(await resolveWorkspaceContext(user), playerId),
});

export { handle as GET, handle as POST, handle as DELETE };
