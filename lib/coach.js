// Herramientas de decisión técnica para el cuerpo técnico. Funciones PURAS (sin I/O) que se
// comparten entre la UI (/coach, ficha de jugador) y el MCP.
//
// Principio rector: NUNCA se inventan datos. Si a un jugador le falta un dato (minutos, valoración
// del staff…) ese criterio se EXCLUYE del cálculo, se re-normaliza el resto y se informa de la
// cobertura. Las reglas de las recomendaciones están a la vista (ver DECISION_RULES): son
// heurísticas para ordenar el trabajo del staff, no una verdad.
import { monthsLeft } from "./tools.js";

export const GROUPS = ["GK", "DF", "MF", "FW"];
export const GROUP_LABEL = { GK: "Porteros", DF: "Defensas", MF: "Centrocampistas", FW: "Delanteros" };

// Posiciones que pueden llegar de las fuentes → línea del campo. Lo desconocido devuelve null.
const ALIASES = {
  GK: ["GK", "POR", "G"],
  DF: ["DF", "DEF", "CB", "LB", "RB", "LWB", "RWB", "WB", "D"],
  MF: ["MF", "MID", "CM", "DM", "AM", "CDM", "CAM", "LM", "RM", "M"],
  FW: ["FW", "ATT", "ST", "CF", "LW", "RW", "SS", "F", "A"],
};
export function positionGroup(pos) {
  const key = String(pos ?? "").trim().toUpperCase().split(/[\s,/·-]+/)[0];
  return GROUPS.find((group) => ALIASES[group].includes(key)) ?? null;
}

// Jugadores de campo por línea. 4-2-3-1 agrupa los 2 pivotes y los 3 mediapuntas en MF.
export const FORMATIONS = {
  "4-3-3": { GK: 1, DF: 4, MF: 3, FW: 3 },
  "4-4-2": { GK: 1, DF: 4, MF: 4, FW: 2 },
  "4-2-3-1": { GK: 1, DF: 4, MF: 5, FW: 1 },
  "3-5-2": { GK: 1, DF: 3, MF: 5, FW: 2 },
  "3-4-3": { GK: 1, DF: 3, MF: 4, FW: 3 },
  "5-3-2": { GK: 1, DF: 5, MF: 3, FW: 2 },
};

// Profundidad mínima razonable por línea para sostener una temporada (titulares + rotación).
export const MIN_DEPTH = { GK: 2, DF: 5, MF: 5, FW: 4 };
// Por debajo de estos minutos los datos por 90' no son fiables y no se calculan.
export const MIN_MINUTES_PER90 = 450;

const isNum = (value) => typeof value === "number" && Number.isFinite(value);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round1 = (x) => Math.round(x * 10) / 10;

// Valoración técnica del staff (0-100) combinando lo que SÍ está valorado: encaje (peso 3),
// disponibilidad (2) y el inverso del riesgo de adaptación (1). null si no hay ninguna valoración.
// `coverage` (0-1) indica qué parte del peso total estaba disponible.
export function suitability(player) {
  const parts = [[player.tacticalFit, 3], [player.availability, 2], [isNum(player.adaptationRisk) ? 100 - player.adaptationRisk : null, 1]];
  const available = parts.filter(([value]) => isNum(value));
  if (!available.length) return { score: null, coverage: 0 };
  const weight = available.reduce((sum, [, w]) => sum + w, 0);
  return { score: Math.round(available.reduce((sum, [value, w]) => sum + value * w, 0) / weight), coverage: weight / 6 };
}

// Goles, asistencias y acciones progresivas por 90 minutos. Cada métrica es null si falta ese dato.
export function per90(player, minMinutes = MIN_MINUTES_PER90) {
  if (!isNum(player.minutes)) return { available: false, reason: "Sin minutos registrados" };
  if (player.minutes < minMinutes) return { available: false, reason: `Muestra pequeña (${player.minutes} min; mínimo ${minMinutes})`, minutes: player.minutes };
  const rate = (count) => (isNum(count) ? round1((count / player.minutes) * 90 * 100) / 100 : null);
  return { available: true, minutes: player.minutes, goals: rate(player.goals), assists: rate(player.assists), progressive: rate(player.progressiveActions) };
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

// Alertas priorizadas para el cuerpo técnico. Cada una dice qué pasa, con qué dato y por qué importa.
export function squadAlerts(players) {
  const alerts = [];
  const add = (severity, player, title, detail) => alerts.push({ severity, playerId: player?.id ?? null, player: player?.name ?? null, title, detail });

  for (const player of players) {
    const months = monthsLeft(player);
    const { score } = suitability(player);
    if (months <= 6) add("high", player, "Contrato a punto de vencer", `Quedan ${months} meses: hay que decidir renovación o salida ya.`);
    else if (months <= 12) add("medium", player, "Contrato en su último año", `Quedan ${months} meses: planifica la decisión esta temporada.`);
    if (isNum(player.availability) && player.availability < 50) add(player.availability < 30 ? "high" : "medium", player, "Disponibilidad baja", `Disponibilidad valorada en ${player.availability}/100.`);
    if (isNum(player.adaptationRisk) && player.adaptationRisk >= 70) add("medium", player, "Riesgo de adaptación alto", `Riesgo valorado en ${player.adaptationRisk}/100.`);
    if (score !== null && score < 50 && months <= 12) add("medium", player, "Bajo encaje y contrato corto", `Valoración técnica ${score}/100 con ${months} meses de contrato: candidato a no renovar.`);
    if (isNum(player.age) && player.age >= 33) add("low", player, "Edad avanzada", `${player.age} años: planifica el relevo en su puesto.`);
  }

  for (const group of GROUPS) {
    const count = players.filter((player) => positionGroup(player.pos) === group).length;
    if (players.length && count < MIN_DEPTH[group]) add(count === 0 ? "high" : "medium", null, `Poca profundidad en ${GROUP_LABEL[group].toLowerCase()}`, `${count} jugador${count === 1 ? "" : "es"} (recomendado: ${MIN_DEPTH[group]} o más).`);
  }

  const unrated = players.filter((player) => suitability(player).score === null);
  if (unrated.length) add("low", null, "Jugadores sin valoración técnica", `${unrated.length} de ${players.length} sin encaje, disponibilidad ni riesgo valorados: las herramientas los dejan fuera.`);

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

// Equilibrio de la plantilla: por línea, cuántos hay frente a la profundidad mínima, edad media y
// contratos que vencen; más cuánto dato real hay detrás de todo esto.
export function squadBalance(players) {
  const lines = GROUPS.map((group) => {
    const members = players.filter((player) => positionGroup(player.pos) === group);
    const ages = members.map((player) => player.age).filter(isNum);
    return {
      group,
      label: GROUP_LABEL[group],
      count: members.length,
      recommended: MIN_DEPTH[group],
      status: members.length === 0 ? "empty" : members.length < MIN_DEPTH[group] ? "low" : "ok",
      averageAge: ages.length ? round1(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null,
      expiring12: members.filter((player) => monthsLeft(player) <= 12).length,
    };
  });
  const share = (predicate) => (players.length ? Math.round((players.filter(predicate).length / players.length) * 100) : 0);
  return {
    total: players.length,
    unclassified: players.filter((player) => positionGroup(player.pos) === null).length,
    lines,
    dataCompleteness: { rated: share((player) => suitability(player).score !== null), withMinutes: share((player) => isNum(player.minutes)) },
  };
}

// Orden de preferencia dentro de una línea: primero los valorados por mayor valoración técnica;
// los no valorados al final (por nombre, para que el resultado sea estable).
const byPreference = (a, b) => {
  const sa = suitability(a).score, sb = suitability(b).score;
  if (sa === null && sb === null) return String(a.name).localeCompare(String(b.name));
  if (sa === null) return 1;
  if (sb === null) return -1;
  return sb - sa || String(a.name).localeCompare(String(b.name));
};

// Once titular sugerido para una formación: en cada línea, los mejor valorados de esa línea.
// Devuelve las posiciones (slots) en orden de campo, el banquillo y avisos de huecos.
export function suggestLineup(players, formationName = "4-3-3") {
  const formation = FORMATIONS[formationName] ?? FORMATIONS["4-3-3"];
  const slots = [];
  const used = new Set();
  const warnings = [];
  for (const group of GROUPS) {
    const picks = players.filter((player) => positionGroup(player.pos) === group).sort(byPreference).slice(0, formation[group]);
    for (let index = 0; index < formation[group]; index += 1) {
      const pick = picks[index];
      if (pick) used.add(pick.id);
      slots.push({ group, playerId: pick?.id ?? null });
    }
    if (picks.length < formation[group]) warnings.push(`Faltan ${formation[group] - picks.length} ${GROUP_LABEL[group].toLowerCase()} para el ${formationName}.`);
  }
  const bench = players.filter((player) => !used.has(player.id)).sort(byPreference).map((player) => player.id);
  return { formation: formationName, slots, bench, warnings };
}

// Revisa un once (manual o sugerido): repetidos, fuera de su línea, contratos/lesiones y sin valorar.
export function checkLineup(slots, players) {
  const byId = new Map(players.map((player) => [player.id, player]));
  const seen = new Set();
  const warnings = [];
  slots.forEach(({ group, playerId }, position) => {
    if (!playerId) { warnings.push(`El puesto ${position + 1} (${GROUP_LABEL[group].toLowerCase()}) está vacío.`); return; }
    const player = byId.get(playerId);
    if (!player) return;
    if (seen.has(playerId)) warnings.push(`${player.name} está repetido en el once.`);
    seen.add(playerId);
    if (positionGroup(player.pos) !== group) warnings.push(`${player.name} juega fuera de su línea (${GROUP_LABEL[group].toLowerCase()}).`);
    if (isNum(player.availability) && player.availability < 50) warnings.push(`${player.name} tiene disponibilidad baja (${player.availability}/100).`);
    if (monthsLeft(player) <= 6) warnings.push(`${player.name} termina contrato en ${monthsLeft(player)} meses.`);
    if (suitability(player).score === null) warnings.push(`${player.name} no tiene valoración técnica.`);
  });
  return [...new Set(warnings)];
}

// Criterios de la matriz de decisión. `from` extrae un valor 0-100 (o null si falta el dato).
const ageScore = (age) => (!isNum(age) ? null : age < 24 ? Math.max(20, 100 - (24 - age) * 8) : age <= 29 ? 100 : Math.max(0, 100 - (age - 29) * 12));
export const CRITERIA = [
  { key: "tacticalFit", label: "Encaje táctico", hint: "Valoración del staff (0-100).", weight: 3, from: (p) => (isNum(p.tacticalFit) ? p.tacticalFit : null) },
  { key: "availability", label: "Disponibilidad", hint: "Valoración del staff (0-100).", weight: 2, from: (p) => (isNum(p.availability) ? p.availability : null) },
  { key: "adaptation", label: "Facilidad de adaptación", hint: "100 menos el riesgo de adaptación.", weight: 1, from: (p) => (isNum(p.adaptationRisk) ? 100 - p.adaptationRisk : null) },
  { key: "goals90", label: "Goles por 90'", hint: "Relativo al máximo de la plantilla (mín. 450 min).", weight: 1, per90: "goals" },
  { key: "assists90", label: "Asistencias por 90'", hint: "Relativo al máximo de la plantilla (mín. 450 min).", weight: 1, per90: "assists" },
  { key: "progressive90", label: "Acciones progresivas por 90'", hint: "Relativo al máximo de la plantilla (mín. 450 min).", weight: 1, per90: "progressive" },
  { key: "age", label: "Edad (pico 24-29)", hint: "Máximo entre los 24 y 29 años.", weight: 1, from: (p) => ageScore(p.age) },
  { key: "contract", label: "Estabilidad contractual", hint: "Meses de contrato, tope 36.", weight: 1, from: (p) => Math.round((Math.min(monthsLeft(p), 36) / 36) * 100) },
];
export const DEFAULT_WEIGHTS = Object.fromEntries(CRITERIA.map((criterion) => [criterion.key, criterion.weight]));

// Pesos válidos: 0-5 por criterio, los que falten o sean basura usan el valor por defecto.
export function normalizeWeights(weights = {}) {
  return Object.fromEntries(CRITERIA.map(({ key, weight }) => [key, isNum(weights[key]) ? clamp(weights[key], 0, 5) : weight]));
}

// Matriz de decisión multicriterio: puntúa cada jugador (0-100) con los pesos del entrenador usando
// SOLO los criterios con dato, e informa de la cobertura (qué parte del peso total tenía dato) y de
// qué criterios faltan. Los jugadores sin ningún criterio disponible quedan al final con score null.
export function decisionMatrix(players, weights = DEFAULT_WEIGHTS, { minMinutes = MIN_MINUTES_PER90 } = {}) {
  const w = normalizeWeights(weights);
  const rates = new Map(players.map((player) => [player.id, per90(player, minMinutes)]));
  const maxOf = (field) => Math.max(0, ...[...rates.values()].filter((rate) => rate.available && isNum(rate[field])).map((rate) => rate[field]));
  const maxima = { goals: maxOf("goals"), assists: maxOf("assists"), progressive: maxOf("progressive") };
  const totalWeight = CRITERIA.reduce((sum, { key }) => sum + w[key], 0);

  const rows = players.map((player) => {
    const parts = {};
    for (const criterion of CRITERIA) {
      if (criterion.per90) {
        const rate = rates.get(player.id);
        parts[criterion.key] = rate.available && isNum(rate[criterion.per90]) && maxima[criterion.per90] > 0 ? Math.round((rate[criterion.per90] / maxima[criterion.per90]) * 100) : null;
      } else parts[criterion.key] = criterion.from(player);
    }
    const used = CRITERIA.filter(({ key }) => parts[key] !== null && w[key] > 0);
    const weight = used.reduce((sum, { key }) => sum + w[key], 0);
    return {
      id: player.id,
      name: player.name,
      score: weight > 0 ? Math.round(used.reduce((sum, { key }) => sum + parts[key] * w[key], 0) / weight) : null,
      coverage: totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0,
      parts,
      missing: CRITERIA.filter(({ key }) => parts[key] === null && w[key] > 0).map(({ label }) => label),
    };
  });
  return rows.sort((a, b) => (a.score === null) - (b.score === null) || (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name));
}

// Reglas de la recomendación, visibles en la UI para que el staff sepa qué hay detrás.
export const DECISION_RULES = [
  "Contrato de 12 meses o menos y valoración técnica de 70 o más → Renovar.",
  "Contrato de 12 meses o menos y valoración técnica menor de 50 → No renovar / valorar salida.",
  "Cualquier otro caso con valoración → Seguir y valorar.",
  "Sin valoración técnica → Sin datos suficientes (no se recomienda nada).",
];

export function decisionFor(player) {
  const months = monthsLeft(player);
  const { score } = suitability(player);
  if (score === null) return { label: "Sin datos suficientes", tone: "neutral", reasons: ["Falta valorar encaje, disponibilidad o riesgo de adaptación."] };
  if (months <= 12 && score >= 70) return { label: "Renovar", tone: "positive", reasons: [`Valoración técnica ${score}/100.`, `Contrato de ${months} meses: conviene asegurarlo.`] };
  if (months <= 12 && score < 50) return { label: "No renovar / valorar salida", tone: "negative", reasons: [`Valoración técnica ${score}/100.`, `Contrato de ${months} meses: ventana para planificar la salida.`] };
  return { label: "Seguir y valorar", tone: "neutral", reasons: [`Valoración técnica ${score}/100.`, `${months} meses de contrato.`] };
}

// Informe técnico de un jugador: lo que sabemos, lo que falta y la recomendación con sus motivos.
export function playerReport(player) {
  const { score, coverage } = suitability(player);
  const rate = per90(player);
  const missing = [];
  if (score === null) missing.push("valoración técnica del staff");
  if (!isNum(player.minutes)) missing.push("minutos jugados");
  else if (!rate.available) missing.push("más minutos (muestra pequeña)");
  if (!player.role) missing.push("rol en el equipo");
  return {
    id: player.id,
    name: player.name,
    group: positionGroup(player.pos),
    months: monthsLeft(player),
    suitability: score,
    suitabilityCoverage: Math.round(coverage * 100),
    per90: rate,
    decision: decisionFor(player),
    alerts: squadAlerts([player]).filter((alert) => alert.playerId === player.id),
    missing,
  };
}
