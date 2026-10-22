import { describe, expect, test } from "bun:test";
import { parsePlayerInput, parsePlayerPatch, playerKey, telHref } from "../lib/player-input.js";

const valid = { name: "  Bukayo Saka ", club: "Arsenal", pos: "fw", age: "25", contractEnd: "2030-06-30" };

describe("parsePlayerInput", () => {
  test("normaliza espacios, posición, edad y fecha", () => {
    expect(parsePlayerInput(valid).data).toEqual({ name: "Bukayo Saka", club: "Arsenal", pos: "FW", age: 25, contractEnd: "2030-06-30T00:00:00.000Z" });
  });
  test("acepta alias de posición y fechas ISO completas", () => {
    expect(parsePlayerInput({ ...valid, pos: "CB", contractEnd: "2029-01-15T10:00:00Z" }).data).toMatchObject({ pos: "DF", contractEnd: "2029-01-15T00:00:00.000Z" });
  });
  test.each([
    ["sin nombre", { name: " " }],
    ["nombre larguísimo", { name: "x".repeat(121) }],
    ["sin club", { club: "" }],
    ["posición desconocida", { pos: "ZZ" }],
    ["edad no entera", { age: "25.5" }],
    ["edad fuera de rango", { age: 13 }],
    ["edad vacía", { age: "" }],
    ["fecha inválida", { contractEnd: "2030-13-45" }],
    ["fecha ausente", { contractEnd: "" }],
    ["año absurdo", { contractEnd: "1800-01-01" }],
  ])("rechaza %s", (_label, patch) => {
    const result = parsePlayerInput({ ...valid, ...patch });
    expect(result.data).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
  });
  test("cuerpo vacío o nulo no lanza", () => {
    expect(parsePlayerInput(undefined).error).toBeDefined();
    expect(parsePlayerInput(null).error).toBeDefined();
  });
});

describe("playerKey", () => {
  test("ignora mayúsculas, tildes y espacios repetidos", () => {
    expect(playerKey("Martin  Ødegaard", "ARSENAL")).toBe(playerKey("martin ødegaard", " Arsenal "));
    expect(playerKey("José Álvarez", "Real  Madrid")).toBe(playerKey("jose alvarez", "real madrid"));
  });
  test("distingue clubes distintos", () => expect(playerKey("A B", "X")).not.toBe(playerKey("A B", "Y")));
});

describe("parsePlayerPatch", () => {
  test("solo valida y devuelve los campos presentes", () => {
    expect(parsePlayerPatch({ phone: " +34 600 000 000 " })).toEqual({ data: { phone: "+34 600 000 000" } });
    expect(parsePlayerPatch({})).toEqual({ data: {} });
    expect(parsePlayerPatch(undefined)).toEqual({ data: {} });
  });
  test("ignora campos que no son editables por aquí", () => {
    expect(parsePlayerPatch({ workspaceId: "otro", $id: "x", staffNotes: "n" }).data).toEqual({});
  });
  test("normaliza básicos: posición por alias, edad, fecha y dinero con coma", () => {
    expect(parsePlayerPatch({ name: " Ana ", club: "Betis", pos: "cb", age: "31", contractEnd: "2029-06-30", value: "12,5", salary: "", fair: 3 }).data)
      .toEqual({ name: "Ana", club: "Betis", pos: "DF", age: 31, contractEnd: "2029-06-30T00:00:00.000Z", value: 12.5, salary: 0, fair: 3 });
  });
  test("un campo opcional vacío borra el dato (null) y el email se guarda en minúsculas", () => {
    expect(parsePlayerPatch({ phone: "", email: "  Agente@Club.ES ", location: " ", agentName: "", agentPhone: "", sourceUrl: "" }).data)
      .toEqual({ phone: null, email: "agente@club.es", location: null, agentName: null, agentPhone: null, sourceUrl: null });
  });
  test.each([
    ["teléfono con letras", { phone: "llámame" }],
    ["teléfono demasiado corto", { phone: "123" }],
    ["teléfono del representante inválido", { agentPhone: "abc" }],
    ["email sin dominio", { email: "a@b" }],
    ["ubicación larguísima", { location: "x".repeat(121) }],
    ["fuente que no es https", { sourceUrl: "javascript:alert(1)" }],
    ["fuente http", { sourceUrl: "http://sitio.com" }],
    ["nombre vacío", { name: "  " }],
    ["posición desconocida", { pos: "ZZ" }],
    ["edad fuera de rango", { age: 60 }],
    ["fecha inválida", { contractEnd: "2030-99-99" }],
    ["valor negativo", { value: "-1" }],
    ["valor absurdo", { salary: "100000" }],
    ["valor no numérico", { fair: "mucho" }],
  ])("rechaza %s", (_label, patch) => {
    const result = parsePlayerPatch(patch);
    expect(result.data).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
  });
});

describe("telHref", () => {
  test("deja solo dígitos y +", () => expect(telHref("+34 (600) 00-00.00")).toBe("tel:+34600000000"));
  test("sin teléfono no hay enlace", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref("")).toBeNull();
  });
});
