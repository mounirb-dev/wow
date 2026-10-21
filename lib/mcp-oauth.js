// Servidor de autorización OAuth 2.1 mínimo para el endpoint MCP (/mcp), pensado para clientes
// como Claude que se conectan por URL. Flujo: registro dinámico de cliente (RFC 7591) →
// autorización con consentimiento + PKCE S256 → canje del código por tokens → refresh.
//
// Diseño SIN ESTADO: clientes, códigos y tokens son JSON firmado con HMAC-SHA256, así que no
// hace falta ninguna tabla nueva y escala horizontalmente. Contrapartida: un token no se puede
// revocar antes de caducar (access 1 h, refresh 30 d); para cortar el acceso a todos los
// clientes hay que rotar MCP_OAUTH_SECRET. Aun así, en cada llamada MCP se vuelve a resolver
// la membresía del usuario, así que quitarle el workspace sí corta el acceso a los datos.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_TTL = 60 * 60;
export const REFRESH_TTL = 60 * 60 * 24 * 30;
export const CODE_TTL = 60;

const b64 = (value) => Buffer.from(value).toString("base64url");

// Clave de firma. MCP_OAUTH_SECRET si existe; si no, se deriva de la API key de Appwrite para
// que funcione sin configurar nada nuevo (la API key ya es un secreto de servidor).
function secret() {
  const base = process.env.MCP_OAUTH_SECRET || process.env.APPWRITE_API_KEY;
  if (!base) throw new Error("Falta MCP_OAUTH_SECRET (o APPWRITE_API_KEY) para firmar tokens MCP");
  return createHmac("sha256", base).update("agentsolver-mcp-oauth-v1").digest();
}

const sign = (body) => createHmac("sha256", secret()).update(body).digest("base64url");

// Firma { t: tipo, exp, ...datos }. El tipo evita usar un código como access token, etc.
export function signToken(type, data, ttlSeconds, now = Date.now()) {
  const body = b64(JSON.stringify({ ...data, t: type, exp: Math.floor(now / 1000) + ttlSeconds }));
  return `${body}.${sign(body)}`;
}

// Devuelve el payload si la firma, el tipo y la caducidad son válidos; si no, null.
export function verifyToken(token, type, now = Date.now()) {
  if (typeof token !== "string") return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.t === type && payload.exp > Math.floor(now / 1000) ? payload : null;
  } catch {
    return null;
  }
}

// PKCE S256: el challenge debe ser base64url(sha256(verifier)). Solo se admite S256.
export function verifyPkce(verifier, challenge) {
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return false;
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const given = Buffer.from(String(challenge ?? ""));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Redirecciones permitidas al registrar un cliente: https, o http solo en localhost (clientes
// de escritorio/Inspector). Nada de javascript:, data: ni http público.
export function isAllowedRedirect(uri) {
  try {
    const url = new URL(uri);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

// Registro dinámico (RFC 7591). El client_id ES el cliente firmado: lleva sus redirect_uris, así
// que luego se valida sin base de datos. Devuelve { error } si la petición no es válida.
export function registerClient(body) {
  const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  if (!uris.length || uris.length > 10 || !uris.every(isAllowedRedirect)) return { error: "invalid_redirect_uri" };
  const name = String(body.client_name ?? "Cliente MCP").slice(0, 100);
  const clientId = signToken("client", { name, uris }, 60 * 60 * 24 * 365 * 10);
  return { client: { client_id: clientId, client_name: name, redirect_uris: uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] } };
}

// Valida una petición de autorización contra el cliente registrado. Si el cliente o la
// redirección no son válidos devuelve { fatal } (NUNCA se redirige: sería un open-redirect);
// el resto de errores se devuelven al cliente por redirección.
export function validateAuthorizeRequest(params) {
  const client = verifyToken(params.client_id, "client");
  if (!client) return { fatal: "client_id desconocido o manipulado" };
  if (!client.uris.includes(params.redirect_uri)) return { fatal: "redirect_uri no registrada para este cliente" };
  if (params.response_type !== "code") return { client, error: "unsupported_response_type" };
  if (params.code_challenge_method !== "S256" || !params.code_challenge) return { client, error: "invalid_request" };
  return { client };
}

// Código de autorización de un solo uso lógico (60 s) ligado a usuario, cliente, redirección y PKCE.
export function issueCode({ user, clientId, redirectUri, codeChallenge }) {
  return signToken("code", { u: { id: user.$id, email: user.email, name: user.name }, c: clientId, r: redirectUri, p: codeChallenge }, CODE_TTL);
}

const issueTokens = (user, clientId) => ({
  access_token: signToken("access", { u: user, c: clientId }, ACCESS_TTL),
  refresh_token: signToken("refresh", { u: user, c: clientId }, REFRESH_TTL),
  token_type: "Bearer",
  expires_in: ACCESS_TTL,
  scope: "mcp",
});

// Endpoint /token: canjea código (+ PKCE) o refresh token. Devuelve { tokens } o { error }.
export function exchange(form) {
  if (form.grant_type === "authorization_code") {
    const code = verifyToken(form.code, "code");
    if (!code || code.c !== form.client_id || code.r !== form.redirect_uri || !verifyPkce(form.code_verifier, code.p)) return { error: "invalid_grant" };
    return { tokens: issueTokens(code.u, code.c) };
  }
  if (form.grant_type === "refresh_token") {
    const refresh = verifyToken(form.refresh_token, "refresh");
    if (!refresh || (form.client_id && refresh.c !== form.client_id)) return { error: "invalid_grant" };
    return { tokens: issueTokens(refresh.u, refresh.c) };
  }
  return { error: "unsupported_grant_type" };
}

// Usuario autenticado a partir de la cabecera Authorization: Bearer <access token>, o null.
export function userFromAuthorization(header) {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  const token = match && verifyToken(match[1], "access");
  return token ? { $id: token.u.id, email: token.u.email, name: token.u.name } : null;
}

// Origen público del servidor, para construir las URL de los metadatos OAuth.
export const originOf = (request) => new URL(request.url).origin;

// Metadatos RFC 8414 (servidor de autorización) y RFC 9728 (recurso protegido).
export const authorizationServerMetadata = (origin) => ({
  issuer: origin,
  authorization_endpoint: `${origin}/mcp/oauth`,
  token_endpoint: `${origin}/api/mcp/oauth/token`,
  registration_endpoint: `${origin}/api/mcp/oauth/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: ["mcp"],
});

export const protectedResourceMetadata = (origin) => ({
  resource: `${origin}/mcp`,
  authorization_servers: [origin],
  scopes_supported: ["mcp"],
  bearer_methods_supported: ["header"],
});
