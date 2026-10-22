import { describe, expect, test } from "bun:test";
import { parsePlayerInput, playerKey } from "../lib/player-input.js";

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
