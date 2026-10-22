import { describe, expect, test } from "bun:test";
import { findClubBadge, isBadgeUrl, pickBadge } from "../lib/crest.js";

const badge = (id) => `https://r2.thesportsdb.com/images/media/team/badge/${id}.png`;
const team = (strTeam, id, extra = {}) => ({ strTeam, strSport: "Soccer", strBadge: badge(id), ...extra });

describe("isBadgeUrl", () => {
  test("solo https de TheSportsDB", () => {
    expect(isBadgeUrl(badge("a"))).toBe(true);
    expect(isBadgeUrl("http://r2.thesportsdb.com/a.png")).toBe(false);
    expect(isBadgeUrl("https://evil.test/a.png")).toBe(false);
    expect(isBadgeUrl("https://r2.thesportsdb.com.evil.test/a.png")).toBe(false);
    expect(isBadgeUrl("no-es-url")).toBe(false);
    expect(isBadgeUrl(undefined)).toBe(false);
  });
});

describe("pickBadge", () => {
  test("coincidencia exacta ignorando FC/AFC y acentos", () => {
    expect(pickBadge([team("Arsenal Women", "w"), team("Arsenal", "ok")], "Arsenal FC")).toBe(badge("ok"));
    expect(pickBadge([team("Girona", "g")], "Girona FC")).toBe(badge("g"));
    expect(pickBadge([team("Atlético Madrid", "a")], "Atletico Madrid")).toBe(badge("a"));
  });
  test("usa los alias del equipo y descarta juveniles", () => {
    const teams = [team("Olympique de Marseille Youth", "y"), team("Marseille", "m", { strTeamAlternate: "Olympique de Marseille, OM" })];
    expect(pickBadge(teams, "Olympique de Marseille")).toBe(badge("m"));
  });
  test("nombre parecido pero con solapamiento suficiente", () => expect(pickBadge([team("Rayo Vallecano", "r")], "Rayo Vallecano de Madrid")).toBe(badge("r")));
  test("otro club con palabras en común no vale", () => expect(pickBadge([team("Real Sociedad", "s")], "Real Madrid CF")).toBeNull());
  test("solo se aceptan equipos de fútbol con escudo de un host permitido", () => {
    expect(pickBadge([team("Boston", "b", { strSport: "Basketball" })], "Boston")).toBeNull();
    expect(pickBadge([{ strTeam: "Boston", strSport: "Soccer", strBadge: "https://evil.test/x.png" }], "Boston")).toBeNull();
  });
  test("sin resultados o nombre vacío", () => {
    expect(pickBadge(null, "Arsenal")).toBeNull();
    expect(pickBadge([team("Arsenal", "a")], "FC")).toBeNull();
  });
  test("una filial no sustituye al primer equipo", () => expect(pickBadge([team("Borussia Dortmund II", "ii")], "Borussia Dortmund")).toBeNull());
});

describe("findClubBadge", () => {
  test("busca primero sin FC/AFC y luego con el nombre original", async () => {
    const urls = [];
    const fetchJson = async (url) => { urls.push(new URL(url).searchParams.get("t")); return urls.length === 1 ? { teams: null } : { teams: [team("SL Benfica", "b")] }; };
    expect(await findClubBadge("SL Benfica", fetchJson)).toBe(badge("b"));
    expect(urls).toEqual(["benfica", "SL Benfica"]);
  });
  test("devuelve null si ninguna búsqueda encuentra el club", async () => expect(await findClubBadge("Club Inventado", async () => ({ teams: [] }))).toBeNull());
  test("un error de red se propaga (quien llama decide qué hacer)", async () => {
    await expect(findClubBadge("Arsenal", async () => { throw new Error("sin red"); })).rejects.toThrow("sin red");
  });
});
