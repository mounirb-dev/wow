// Clubes europeos desde OpenFootball (https://github.com/openfootball/football.json): datos
// abiertos en JSON servidos por raw.githubusercontent.com, sin API key. Cada archivo es una liga
// de una temporada; los clubes se sacan de los partidos (team1/team2).
const BASE = "https://raw.githubusercontent.com/openfootball/football.json/master";

// Ligas publicadas por OpenFootball (códigos de archivo: país.división).
export const LEAGUE_FILES = ["en.1", "en.2", "en.3", "en.4", "es.1", "es.2", "de.1", "de.2", "it.1", "it.2", "fr.1", "fr.2", "nl.1", "pt.1", "be.1", "sco.1", "tr.1", "gr.1", "at.1", "at.2"];

// Temporadas a probar, de la más reciente a la anterior: una nueva temporada puede no estar
// publicada todavía en las primeras semanas. Empieza en julio: 2026-27 desde julio de 2026.
export function seasonsToTry(now = new Date()) {
  const start = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return [start, start - 1].map((year) => `${year}-${String(year + 1).slice(-2)}`);
}

// { name: "Spain Primera División 2025/26", matches: [...] } -> { league, clubs } (clubs únicos y ordenados).
export function extractClubs(data) {
  const clubs = new Set();
  for (const match of data?.matches ?? []) for (const team of [match.team1, match.team2]) if (typeof team === "string" && team.trim()) clubs.add(team.trim());
  const league = String(data?.name ?? "").replace(/\s*\d{4}(?:\/\d{2,4})?\s*$/, "").trim();
  return { league, clubs: [...clubs].sort((a, b) => a.localeCompare(b, "es")) };
}

async function loadLeague(code, seasons, fetchJson) {
  for (const season of seasons) {
    try {
      const data = await fetchJson(`${BASE}/${season}/${code}.json`);
      const league = extractClubs(data);
      if (league.clubs.length) return { id: code, ...league };
    } catch { /* temporada no publicada: se prueba la anterior */ }
  }
  return null;
}

// Ligas con sus clubes. Las que no se pueden descargar se omiten en vez de romper todo el listado.
export async function loadEuropeanClubs(fetchJson, now = new Date()) {
  const seasons = seasonsToTry(now);
  const leagues = await Promise.all(LEAGUE_FILES.map((code) => loadLeague(code, seasons, fetchJson)));
  return leagues.filter(Boolean);
}
