// Validación de los datos de un jugador, común a la UI, la API y el MCP. Pura (sin I/O): devuelve
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

// --- Edición: cada campo presente en el cuerpo se valida y normaliza; los que faltan no se tocan. ---
// Un texto opcional vacío significa "borrar el dato" (null).
const PHONE = /^\+?[\d\s().-]{6,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_MONEY = 10000; // millones

const required = (label, max) => (value) => {
  const text = String(value ?? "").trim();
  return !text || text.length > max ? { error: `${label} es obligatorio (máximo ${max} caracteres)` } : { value: text };
};
const optional = (label, max, pattern = null, transform = (text) => text) => (value) => {
  const text = String(value ?? "").trim();
  if (!text) return { value: null };
  return text.length > max || (pattern && !pattern.test(text)) ? { error: `${label} no es válido` } : { value: transform(text) };
};
const money = (label) => (value) => {
  const text = String(value ?? "").trim();
  const amount = text === "" ? 0 : Number(text.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 && amount <= MAX_MONEY ? { value: amount } : { error: `${label} debe ser un número entre 0 y ${MAX_MONEY} (millones)` };
};

const PARSERS = {
  name: required("El nombre", MAX_TEXT),
  club: required("El club", MAX_TEXT),
  pos: (value) => { const pos = positionGroup(value); return pos ? { value: pos } : { error: "La posición debe ser GK, DF, MF o FW" }; },
  age: (value) => { const age = Number(value); return Number.isInteger(age) && age >= MIN_AGE && age <= MAX_AGE ? { value: age } : { error: `La edad debe ser un entero entre ${MIN_AGE} y ${MAX_AGE}` }; },
  contractEnd: (value) => { const date = parseDate(value); return date ? { value: date } : { error: "El fin de contrato no es una fecha válida (usa AAAA-MM-DD)" }; },
  value: money("El valor"),
  salary: money("El salario"),
  fair: money("El valor de mercado"),
  phone: optional("El teléfono", 30, PHONE),
  email: optional("El email", 255, EMAIL, (text) => text.toLowerCase()),
  location: optional("La ubicación", MAX_TEXT),
  agentName: optional("El representante", MAX_TEXT),
  agentPhone: optional("El teléfono del representante", 30, PHONE),
  // Solo https: la URL se usa como enlace en la ficha.
  sourceUrl: optional("La fuente", 500, /^https:\/\/\S+$/),
};

// Enlace tel: solo con dígitos y +, para que un teléfono mal escrito no genere un enlace raro.
export const telHref = (phone) => (phone ? `tel:${String(phone).replace(/[^\d+]/g, "")}` : null);

// Campos editables que no son de rendimiento ni del staff: datos básicos, económicos y de contacto.
export const EDITABLE_FIELDS = Object.keys(PARSERS);

export function parsePlayerPatch(body) {
  const data = {};
  for (const [field, parse] of Object.entries(PARSERS)) {
    if (!Object.hasOwn(body ?? {}, field)) continue;
    const result = parse(body[field]);
    if (result.error) return { error: result.error };
    data[field] = result.value;
  }
  return { data };
}
