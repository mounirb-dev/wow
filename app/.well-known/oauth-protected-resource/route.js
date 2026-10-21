// Metadatos RFC 9728 del recurso protegido: dicen al cliente qué servidor de autorización usar.
import { originOf, protectedResourceMetadata } from "@/lib/mcp-oauth.js";

export const GET = (request) => Response.json(protectedResourceMetadata(originOf(request)), { headers: { "cache-control": "public, max-age=300" } });
