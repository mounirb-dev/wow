// Validación de un jugador nuevo, común a la UI, la API y el MCP. Pura (sin I/O): devuelve
// { data } con los campos ya normalizados o { error } con un mensaje legible.
import { positionGroup } from "./coach.js";

const MAX_TEXT = 120;
const MIN_AGE = 14;
const MAX_AGE = 50;

// Acepta "2028-06-30" o una fecha ISO completa; devuelve ISO UTC o null.
function parseDate(value) {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(String(value ?? "").trim())?.[0];
  if (!day) return null;
  const date = new Date(`${day}T00:00:00.000Z`);
  const year = date.getUTCFullYear();
  return Number.isNaN(date.getTime()) || year < 1990 || year > 2100 ? null : date.toISOString();
}

// Misma persona = mismo nombre y club sin importar mayúsculas, tildes ni espacios repetidos.
export const playerKey = (name, club) => [name, club].map((part) => String(part ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()).join("|");

export function parsePlayerInput(body) {
  const name = String(body?.name ?? "").trim();
  const club = String(body?.club ?? "").trim();
  // positionGroup acepta alias (CB, ST, POR…) y los lleva a la línea GK/DF/MF/FW.
  const pos = positionGroup(body?.pos);
  const age = Number(body?.age);
  const contractEnd = parseDate(body?.contractEnd);

  if (!name || name.length > MAX_TEXT) return { error: `El nombre es obligatorio (máximo ${MAX_TEXT} caracteres)` };
  if (!club || club.length > MAX_TEXT) return { error: `El club es obligatorio (máximo ${MAX_TEXT} caracteres)` };
  if (!pos) return { error: "La posición debe ser GK, DF, MF o FW" };
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) return { error: `La edad debe ser un entero entre ${MIN_AGE} y ${MAX_AGE}` };
  if (!contractEnd) return { error: "El fin de contrato no es una fecha válida (usa AAAA-MM-DD)" };
  return { data: { name, club, pos, age, contractEnd } };
}
