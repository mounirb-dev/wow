// Manejador HTTP del endpoint MCP (Streamable HTTP, SIN estado: un servidor y un transporte
// nuevos por petición, válido en serverless). La autenticación y la carga de datos se inyectan
// para poder probarlo sin Appwrite.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp-tools.js";
import { canWrite, originOf } from "./mcp-oauth.js";

// 401 con la pista RFC 9728 que usan los clientes para descubrir dónde autenticarse.
const unauthorized = (request) => new Response(JSON.stringify({ error: "unauthorized" }), {
  status: 401,
  headers: { "content-type": "application/json", "www-authenticate": `Bearer resource_metadata="${originOf(request)}/.well-known/oauth-protected-resource/mcp"` },
});

// Las funciones de escritura se inyectan; solo llegan al servidor si el token tiene permiso de edición.
export async function handleMcpRequest(request, { authenticate, loadPlayers, ...writers }) {
  const user = await authenticate(request);
  if (!user) return unauthorized(request);
  // Sin sesiones: cada petición es independiente y responde JSON en vez de abrir un stream SSE.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const allowed = canWrite(user) ? writers : {};
  const bind = (name) => allowed[name] && ((...args) => allowed[name](user, ...args));
  const server = createMcpServer({
    loadPlayers: () => loadPlayers(user),
    addPlayer: bind("addPlayer"),
    removePlayer: bind("removePlayer"),
    updatePlayer: bind("updatePlayer"),
    saveOpinion: bind("saveOpinion"),
    addSuitor: bind("addSuitor"),
    removeSuitor: bind("removeSuitor"),
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Se libera cuando la respuesta ya está construida (modo JSON: no hay stream que mantener).
    queueMicrotask(() => server.close().catch(() => {}));
  }
}
