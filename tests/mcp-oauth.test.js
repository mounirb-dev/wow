import { beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { ACCESS_TTL, authorizationServerMetadata, exchange, isAllowedRedirect, issueCode, protectedResourceMetadata, registerClient, signToken, userFromAuthorization, validateAuthorizeRequest, verifyPkce, verifyToken } from "../lib/mcp-oauth.js";

beforeAll(() => { process.env.MCP_OAUTH_SECRET = "test-secret-no-usar-en-produccion"; });

const user = { $id: "u1", email: "agente@club.com", name: "Agente" };
const verifier = "a".repeat(64);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const redirect = "https://claude.ai/api/mcp/auth_callback";
const newClient = () => registerClient({ client_name: "Claude", redirect_uris: [redirect] }).client;

describe("tokens firmados", () => {
  test("ida y vuelta", () => expect(verifyToken(signToken("access", { x: 1 }, 60), "access")).toMatchObject({ x: 1, t: "access" }));
  test("rechaza un tipo distinto (un código no vale como access token)", () => expect(verifyToken(signToken("code", {}, 60), "access")).toBeNull());
  test("rechaza caducados", () => expect(verifyToken(signToken("access", {}, 60, Date.now() - 120_000), "access")).toBeNull());
  test("rechaza manipulados", () => {
    const [body, sig] = signToken("access", { u: "x" }, 60).split(".");
    const forged = Buffer.from(JSON.stringify({ t: "access", u: "admin", exp: 9e9 })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, "access")).toBeNull();
    expect(verifyToken(`${body}.${sig}x`, "access")).toBeNull();
  });
  test.each([undefined, null, "", "abc", "a.b.c", 5])("rechaza basura %p", (value) => expect(verifyToken(value, "access")).toBeNull());
  test("un secreto distinto invalida los tokens", () => {
    const token = signToken("access", {}, 60);
    process.env.MCP_OAUTH_SECRET = "otro";
    try { expect(verifyToken(token, "access")).toBeNull(); } finally { process.env.MCP_OAUTH_SECRET = "test-secret-no-usar-en-produccion"; }
  });
});

describe("PKCE", () => {
  test("acepta el verifier correcto", () => expect(verifyPkce(verifier, challenge)).toBe(true));
  test("rechaza otro verifier, uno corto o ausente", () => {
    expect(verifyPkce("b".repeat(64), challenge)).toBe(false);
    expect(verifyPkce("corto", challenge)).toBe(false);
    expect(verifyPkce(undefined, challenge)).toBe(false);
  });
});

describe("redirecciones y registro", () => {
  test.each(["https://claude.ai/cb", "http://localhost:3000/cb", "http://127.0.0.1/cb"])("permite %s", (uri) => expect(isAllowedRedirect(uri)).toBe(true));
  test.each(["http://evil.com/cb", "javascript:alert(1)", "data:text/html,x", "https://a.com/cb#frag", "no-es-url", ""])("rechaza %s", (uri) => expect(isAllowedRedirect(uri)).toBe(false));
  test("registro válido devuelve un client_id verificable", () => expect(verifyToken(newClient().client_id, "client")).toMatchObject({ name: "Claude", uris: [redirect] }));
  test("registro sin redirecciones válidas falla", () => {
    expect(registerClient({ redirect_uris: [] }).error).toBe("invalid_redirect_uri");
    expect(registerClient({ redirect_uris: ["http://evil.com"] }).error).toBe("invalid_redirect_uri");
    expect(registerClient(null).error).toBe("invalid_redirect_uri");
  });
});

describe("autorización", () => {
  const base = () => ({ client_id: newClient().client_id, redirect_uri: redirect, response_type: "code", code_challenge: challenge, code_challenge_method: "S256" });
  test("petición válida", () => expect(validateAuthorizeRequest(base()).fatal).toBeUndefined());
  test("cliente manipulado o redirección ajena son fatales (no se redirige)", () => {
    expect(validateAuthorizeRequest({ ...base(), client_id: "falso" }).fatal).toBeDefined();
    expect(validateAuthorizeRequest({ ...base(), redirect_uri: "https://evil.com/cb" }).fatal).toBeDefined();
  });
  test("sin PKCE S256 o con otro response_type se devuelve error al cliente", () => {
    expect(validateAuthorizeRequest({ ...base(), code_challenge_method: "plain" }).error).toBe("invalid_request");
    expect(validateAuthorizeRequest({ ...base(), code_challenge: "" }).error).toBe("invalid_request");
    expect(validateAuthorizeRequest({ ...base(), response_type: "token" }).error).toBe("unsupported_response_type");
  });
});

describe("canje de tokens", () => {
  const code = () => { const { client_id } = newClient(); return { client_id, code: issueCode({ user, clientId: client_id, redirectUri: redirect, codeChallenge: challenge }) }; };
  const form = (over = {}) => ({ grant_type: "authorization_code", redirect_uri: redirect, code_verifier: verifier, ...code(), ...over });

  test("código + PKCE correctos emiten access y refresh", () => {
    const { tokens } = exchange(form());
    expect(tokens.token_type).toBe("Bearer");
    expect(tokens.expires_in).toBe(ACCESS_TTL);
    expect(userFromAuthorization(`Bearer ${tokens.access_token}`)).toEqual(user);
  });
  test("falla con verifier incorrecto, redirect distinta, client distinto o código basura", () => {
    expect(exchange(form({ code_verifier: "b".repeat(64) })).error).toBe("invalid_grant");
    expect(exchange(form({ redirect_uri: "https://evil.com/cb" })).error).toBe("invalid_grant");
    expect(exchange(form({ client_id: "otro" })).error).toBe("invalid_grant");
    expect(exchange(form({ code: "basura" })).error).toBe("invalid_grant");
  });
  test("el refresh token renueva y no sirve como access token", () => {
    const { tokens } = exchange(form());
    expect(userFromAuthorization(`Bearer ${tokens.refresh_token}`)).toBeNull();
    const renewed = exchange({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
    expect(userFromAuthorization(`Bearer ${renewed.tokens.access_token}`)).toEqual(user);
  });
  test("grant desconocido o refresh falso", () => {
    expect(exchange({ grant_type: "password" }).error).toBe("unsupported_grant_type");
    expect(exchange({ grant_type: "refresh_token", refresh_token: "x" }).error).toBe("invalid_grant");
  });
  test("userFromAuthorization sin cabecera o con esquema distinto", () => {
    expect(userFromAuthorization(undefined)).toBeNull();
    expect(userFromAuthorization("Basic abc")).toBeNull();
  });
});

describe("metadatos", () => {
  test("anuncian PKCE S256, registro dinámico y rutas bajo el mismo origen", () => {
    const meta = authorizationServerMetadata("https://app.test");
    expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
    expect(meta.registration_endpoint).toBe("https://app.test/api/mcp/oauth/register");
    expect(protectedResourceMetadata("https://app.test")).toMatchObject({ resource: "https://app.test/mcp", authorization_servers: ["https://app.test"] });
  });
});
