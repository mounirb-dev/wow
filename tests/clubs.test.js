import { describe, expect, test } from "bun:test";
import { LEAGUE_FILES, extractClubs, loadEuropeanClubs, seasonsToTry } from "../lib/clubs.js";

describe("seasonsToTry", () => {
  test("desde julio la temporada nueva va primero", () => expect(seasonsToTry(new Date("2026-10-22"))).toEqual(["2026-27", "2025-26"]));
  test("antes de julio sigue la temporada que empezó el año anterior", () => expect(seasonsToTry(new Date("2026-03-01"))).toEqual(["2025-26", "2024-25"]));
  test("cambio de siglo del sufijo", () => expect(seasonsToTry(new Date("2099-08-01"))).toEqual(["2099-00", "2098-99"]));
});

describe("extractClubs", () => {
  const data = { name: "Spain Primera División 2025/26", matches: [{ team1: "Girona FC", team2: "Real Oviedo" }, { team1: "Real Oviedo", team2: "  Girona FC " }, { team1: "Athletic Club", team2: "" }, { team1: null, team2: "Elche CF" }] };
  test("clubes únicos, ordenados y sin valores vacíos", () => expect(extractClubs(data).clubs).toEqual(["Athletic Club", "Elche CF", "Girona FC", "Real Oviedo"]));
  test("quita la temporada del nombre de la liga", () => expect(extractClubs(data).league).toBe("Spain Primera División"));
  test("datos inesperados no rompen", () => expect(extractClubs(null)).toEqual({ league: "", clubs: [] }));
});

describe("loadEuropeanClubs", () => {
  const now = new Date("2026-10-22");
  test("usa la temporada anterior si la nueva no está publicada y omite ligas que fallan", async () => {
    const urls = [];
    const fetchJson = async (url) => {
      urls.push(url);
      if (url.includes("/en.2.")) throw new Error("404");
      if (url.includes("/2026-27/")) throw new Error("404");
      return { name: "Liga 2025/26", matches: [{ team1: "A", team2: "B" }] };
    };
    const leagues = await loadEuropeanClubs(fetchJson, now);
    expect(leagues).toHaveLength(LEAGUE_FILES.length - 1);
    expect(leagues.find((league) => league.id === "es.1")).toEqual({ id: "es.1", league: "Liga", clubs: ["A", "B"] });
    expect(urls).toContain("https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/es.1.json");
    expect(urls).toContain("https://raw.githubusercontent.com/openfootball/football.json/master/2025-26/es.1.json");
  });
  test("si todo falla devuelve lista vacía", async () => expect(await loadEuropeanClubs(async () => { throw new Error("sin red"); }, now)).toEqual([]));
});
