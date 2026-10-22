import { beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { exchange, issueCode, registerClient } from "../lib/mcp-oauth.js";
import { handleMcpRequest } from "../lib/mcp-http.js";
import { userFromAuthorization } from "../lib/mcp-oauth.js";

beforeAll(() => { process.env.MCP_OAUTH_SECRET = "test-secret-no-usar-en-produccion"; });

const player = { id: "saka", name: "Bukayo Saka", age: 25, pos: "FW", club: "Arsenal", contractEnd: new Date(Date.now() + 10 * 30.44 * 864e5).toISOString(), value: 100, salary: 10, fair: 12, momentum: 0.7, suitors: [{ club: "Real Madrid", need: 90 }] };
const calls = [];
const writes = [];
const playerError = (message, status) => Object.assign(new Error(message), { name: "PlayerError", status });
const deps = {
  authenticate: (req) => userFromAuthorization(req.headers.get("authorization")),
  loadPlayers: async (user) => { calls.push(user.$id); return [player]; },
  addPlayer: async (user, input) => {
    writes.push(["add", user.$id, input]);
    if (input.name === "Repetido") throw playerError("Ya tienes un jugador con ese nombre y club", 409);
    return { $id: "nuevo1", ...input, pos: "FW" };
  },
  removePlayer: async (user, playerId) => {
    writes.push(["remove", user.$id, playerId]);
    if (playerId === "nadie") throw playerError("Jugador no encontrado", 404);
    return { name: "Bukayo Saka", club: "Arsenal" };
  },
};

const rpc = (token, method, params = {}, id = 1) => new Request("https://app.test/mcp", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token && { authorization: `Bearer ${token}` }) },
  body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
});

// Recorre el flujo OAuth completo igual que lo haría Claude y devuelve un access token real.
function login() {
  const verifier = "v".repeat(64);
  const redirect = "https://claude.ai/api/mcp/auth_callback";
  const { client } = registerClient({ client_name: "Claude", redirect_uris: [redirect] });
  const code = issueCode({ user: { $id: "u1", email: "a@b.c", name: "A" }, clientId: client.client_id, redirectUri: redirect, codeChallenge: createHash("sha256").update(verifier).digest("base64url") });
  return exchange({ grant_type: "authorization_code", code, client_id: client.client_id, redirect_uri: redirect, code_verifier: verifier }).tokens.access_token;
}

describe("endpoint /mcp", () => {
  test("sin token responde 401 con la pista de descubrimiento OAuth", async () => {
    const res = await handleMcpRequest(rpc(null, "tools/list"), deps);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('resource_metadata="https://app.test/.well-known/oauth-protected-resource/mcp"');
  });
  test("token inválido responde 401", async () => expect((await handleMcpRequest(rpc("falso", "tools/list"), deps)).status).toBe(401));

  test("initialize y tools/list con un token real", async () => {
    const token = login();
    const init = await (await handleMcpRequest(rpc(token, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } }), deps)).json();
    expect(init.result.serverInfo.name).toBe("agentsolver");
    const list = await (await handleMcpRequest(rpc(token, "tools/list", {}, 2), deps)).json();
    expect(list.result.tools.map((t) => t.name).sort()).toEqual(["add_player", "decision_matrix", "delete_player", "lineup_suggestion", "list_clients", "negotiation_brief", "player_report", "portfolio_summary", "squad_alerts", "squad_balance", "valuation"]);
    // Solo las dos herramientas de escritura dejan de ser de solo lectura, y borrar se marca como destructiva.
    expect(list.result.tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name).sort()).toEqual(["add_player", "delete_player"]);
    expect(list.result.tools.find((t) => t.name === "delete_player").annotations.destructiveHint).toBe(true);
    expect(list.result.tools.find((t) => t.name === "add_player").annotations.destructiveHint).toBe(false);
  });

  test("tools/call usa el usuario del token para cargar los datos", async () => {
    const token = login();
    calls.length = 0;
    const res = await (await handleMcpRequest(rpc(token, "tools/call", { name: "valuation", arguments: { playerId: "saka" } }, 3), deps)).json();
    expect(JSON.parse(res.result.content[0].text)).toMatchObject({ name: "Bukayo Saka", leverage: expect.any(Number), monthsLeft: expect.any(Number) });
    expect(calls).toContain("u1");
  });
  test("jugador inexistente devuelve isError, no excepción", async () => {
    const res = await (await handleMcpRequest(rpc(login(), "tools/call", { name: "valuation", arguments: { playerId: "nadie" } }, 4), deps)).json();
    expect(res.result.isError).toBe(true);
  });
  test("negotiation_brief y portfolio_summary", async () => {
    const token = login();
    const brief = await (await handleMcpRequest(rpc(token, "tools/call", { name: "negotiation_brief", arguments: { playerId: "saka" } }, 5), deps)).json();
    expect(JSON.parse(brief.result.content[0].text).club).toBe("Real Madrid");
    const summary = await (await handleMcpRequest(rpc(token, "tools/call", { name: "portfolio_summary", arguments: {} }, 6), deps)).json();
    expect(JSON.parse(summary.result.content[0].text)).toMatchObject({ aum: 100, count: 1 });
  });
  test("herramientas del cuerpo técnico: alertas, equilibrio, once, matriz e informe", async () => {
    const token = login();
    const call = async (name, args = {}, id = 20) => JSON.parse((await (await handleMcpRequest(rpc(token, "tools/call", { name, arguments: args }, id), deps)).json()).result.content[0].text);
    expect((await call("squad_alerts")).some((alert) => alert.title.startsWith("Poca profundidad"))).toBe(true);
    expect((await call("squad_balance")).total).toBe(1);
    const lineup = await call("lineup_suggestion", { formation: "4-4-2" });
    expect(lineup.formation).toBe("4-4-2");
    expect(lineup.starters).toHaveLength(11);
    expect(lineup.starters.filter((slot) => slot.player === "Bukayo Saka")).toHaveLength(1);
    const matrix = await call("decision_matrix", { weights: { contract: 5 }, line: "FW" });
    expect(matrix.weights.contract).toBe(5);
    expect(matrix.ranking[0].name).toBe("Bukayo Saka");
    const report = await call("player_report", { playerId: "saka" });
    expect(report.decision.label).toBe("Sin datos suficientes");
    expect(report.missing).toContain("valoración técnica del staff");
  });
  test("formación inexistente se rechaza por esquema", async () => {
    const res = await (await handleMcpRequest(rpc(login(), "tools/call", { name: "lineup_suggestion", arguments: { formation: "9-9-9" } }, 21), deps)).json();
    expect(res.error || res.result?.isError).toBeTruthy();
  });
  test("argumentos inválidos se rechazan por esquema", async () => {
    const res = await (await handleMcpRequest(rpc(login(), "tools/call", { name: "valuation", arguments: { playerId: 7 } }, 7), deps)).json();
    expect(res.error || res.result?.isError).toBeTruthy();
  });

  const call = async (token, name, args, id = 40) => (await handleMcpRequest(rpc(token, "tools/call", { name, arguments: args }, id), deps)).json();

  test("sin funciones de escritura inyectadas no se ofrecen add_player ni delete_player", async () => {
    const list = await (await handleMcpRequest(rpc(login(), "tools/list", {}, 30), { authenticate: deps.authenticate, loadPlayers: deps.loadPlayers })).json();
    expect(list.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true);
  });

  test("add_player crea el jugador con el usuario del token y devuelve su id", async () => {
    writes.length = 0;
    const res = await call(login(), "add_player", { name: "Nuevo", club: "Club", pos: "ST", age: 22, contractEnd: "2029-06-30" });
    expect(res.result.isError).toBeFalsy();
    expect(JSON.parse(res.result.content[0].text).added).toMatchObject({ id: "nuevo1", name: "Nuevo", pos: "FW" });
    expect(writes).toEqual([["add", "u1", { name: "Nuevo", club: "Club", pos: "ST", age: 22, contractEnd: "2029-06-30" }]]);
  });

  test("add_player: duplicado o rol sin permiso llegan como isError con el motivo, no como excepción", async () => {
    const res = await call(login(), "add_player", { name: "Repetido", club: "Club", pos: "MF", age: 30, contractEnd: "2029-06-30" });
    expect(res.result.isError).toBe(true);
    expect(JSON.parse(res.result.content[0].text)).toMatchObject({ error: expect.stringContaining("Ya tienes"), status: 409 });
  });

  test("add_player rechaza por esquema una edad que no es entera", async () => {
    writes.length = 0;
    const res = await call(login(), "add_player", { name: "X", club: "Y", pos: "MF", age: 22.5, contractEnd: "2029-06-30" });
    expect(res.error || res.result?.isError).toBeTruthy();
    expect(writes).toEqual([]);
  });

  test("delete_player exige confirm: true; sin él no se borra nada", async () => {
    writes.length = 0;
    const token = login();
    for (const args of [{ playerId: "saka" }, { playerId: "saka", confirm: false }]) {
      const res = await call(token, "delete_player", args);
      expect(res.error || res.result?.isError).toBeTruthy();
    }
    expect(writes).toEqual([]);
    const ok = await call(token, "delete_player", { playerId: "saka", confirm: true });
    expect(JSON.parse(ok.result.content[0].text).deleted).toEqual({ id: "saka", name: "Bukayo Saka", club: "Arsenal" });
    expect(writes).toEqual([["remove", "u1", "saka"]]);
  });

  test("delete_player de un jugador inexistente o ajeno devuelve isError 404", async () => {
    const res = await call(login(), "delete_player", { playerId: "nadie", confirm: true });
    expect(res.result.isError).toBe(true);
    expect(JSON.parse(res.result.content[0].text).status).toBe(404);
  });
});
