// Manejador HTTP del endpoint MCP (Streamable HTTP, SIN estado: un servidor y un transporte
// nuevos por petición, válido en serverless). La autenticación y la carga de datos se inyectan
// para poder probarlo sin Appwrite.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp-tools.js";
import { originOf } from "./mcp-oauth.js";

// 401 con la pista RFC 9728 que usan los clientes para descubrir dónde autenticarse.
const unauthorized = (request) => new Response(JSON.stringify({ error: "unauthorized" }), {
  status: 401,
  headers: { "content-type": "application/json", "www-authenticate": `Bearer resource_metadata="${originOf(request)}/.well-known/oauth-protected-resource/mcp"` },
});

export async function handleMcpRequest(request, { authenticate, loadPlayers }) {
  const user = await authenticate(request);
  if (!user) return unauthorized(request);
  // Sin sesiones: cada petición es independiente y responde JSON en vez de abrir un stream SSE.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = createMcpServer({ loadPlayers: () => loadPlayers(user) });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Se libera cuando la respuesta ya está construida (modo JSON: no hay stream que mantener).
    queueMicrotask(() => server.close().catch(() => {}));
  }
}
