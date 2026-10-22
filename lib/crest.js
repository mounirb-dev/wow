// Escudo de un club (lógica pura + búsqueda). OpenFootball no trae escudos, así que se busca en
// TheSportsDB con su clave pública de pruebas ("123", documentada, sin registro ni secreto).
const SEARCH = "https://www.thesportsdb.com/api/v1/json/123/searchteams.php";
const BADGE_HOSTS = new Set(["r2.thesportsdb.com", "www.thesportsdb.com"]);

// Palabras que no distinguen al club ("FC", "AFC"…) y que cambian de una fuente a otra.
const NOISE = new Set(["fc", "afc", "cf", "sc", "ac", "sl", "fk", "sk", "bk", "cd", "ud", "rc", "sv", "ss", "us", "club", "de", "del", "la", "el", "the", "of"]);
// Equipos que no son el primer equipo: se descartan aunque el nombre se parezca.
const EXCLUDED = /\b(youth|women|ladies|feminin\w*|reserves?|academy|u\d{2}|ii|iii|b)\b/i;

const tokens = (name) => String(name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((token) => token && !NOISE.has(token));
const key = (name) => tokens(name).join(" ");

// Solo se descargan imágenes de los hosts de TheSportsDB, por https (evita SSRF si la API devolviera otra URL).
export function isBadgeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && BADGE_HOSTS.has(url.hostname);
  } catch { return false; }
}

// Elige el equipo de la lista de resultados: solo fútbol, sin juveniles/femenino/filiales; primero
// coincidencia exacta del nombre (o de un alias) y, si no, la de mayor solapamiento de palabras.
export function pickBadge(teams, name) {
  const wanted = new Set(tokens(name));
  if (!wanted.size) return null;
  const scored = (teams ?? [])
    .filter((team) => team.strSport === "Soccer" && isBadgeUrl(team.strBadge) && !EXCLUDED.test(team.strTeam ?? ""))
    .map((team) => {
      const names = [team.strTeam, ...String(team.strTeamAlternate ?? "").split(",")].map((item) => item.trim()).filter(Boolean);
      const score = Math.max(0, ...names.map((candidate) => {
        if (key(candidate) === key(name)) return 1;
        const own = new Set(tokens(candidate));
        const shared = [...own].filter((token) => wanted.has(token)).length;
        return shared / (own.size + wanted.size - shared || 1);
      }));
      return { url: team.strBadge, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 0.6 ? scored[0].url : null;
}

// URL del escudo (o null). Busca por el nombre sin "FC"/"AFC" y, si no hay resultado, por el original.
export async function findClubBadge(name, fetchJson) {
  const queries = [...new Set([tokens(name).join(" "), String(name).trim()].filter(Boolean))];
  for (const query of queries) {
    const url = new URL(SEARCH);
    url.searchParams.set("t", query);
    const data = await fetchJson(url.toString());
    const badge = pickBadge(data?.teams, name);
    if (badge) return badge;
  }
  return null;
}
