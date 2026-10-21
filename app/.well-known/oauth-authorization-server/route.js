// Metadatos RFC 8414 del servidor de autorización (endpoints, PKCE S256, registro dinámico).
import { authorizationServerMetadata, originOf } from "@/lib/mcp-oauth.js";

export const GET = (request) => Response.json(authorizationServerMetadata(originOf(request)), { headers: { "cache-control": "public, max-age=300" } });
