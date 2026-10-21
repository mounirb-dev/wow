import { describe, expect, test } from "bun:test";
import { CRITERIA, DEFAULT_WEIGHTS, FORMATIONS, checkLineup, decisionFor, decisionMatrix, normalizeWeights, per90, playerReport, positionGroup, squadAlerts, squadBalance, suggestLineup, suitability } from "../lib/coach.js";

const inMonths = (n) => new Date(Date.now() + n * 30.44 * 864e5 + 864e5).toISOString();
let counter = 0;
const make = (over = {}) => {
  counter += 1;
  return { id: `p${counter}`, name: `Jugador ${String(counter).padStart(2, "0")}`, pos: "MF", age: 26, contractEnd: inMonths(30), value: 0, salary: 0, fair: 0, momentum: 0.5, minutes: null, goals: null, assists: null, progressiveActions: null, role: null, tacticalFit: null, availability: null, adaptationRisk: null, suitors: [], ...over };
};
const squad = () => [
  ...["GK", "GK"].map((pos) => make({ pos })),
  ...Array.from({ length: 5 }, () => make({ pos: "DF" })),
  ...Array.from({ length: 5 }, () => make({ pos: "MF" })),
  ...Array.from({ length: 4 }, () => make({ pos: "FW" })),
];

describe("positionGroup", () => {
  test.each([["GK", "GK"], ["DF", "DF"], ["cb", "DF"], ["LB", "DF"], ["MF", "MF"], ["CDM", "MF"], ["FW", "FW"], ["ST", "FW"], ["RW", "FW"], ["MF/FW", "MF"], ["POR", "GK"]])("%s → %s", (pos, group) => expect(positionGroup(pos)).toBe(group));
  test.each([["XX"], [""], [null], [undefined], [42]])("%p no se clasifica", (pos) => expect(positionGroup(pos)).toBeNull());
});

describe("suitability", () => {
  test("sin ninguna valoración no inventa nada", () => expect(suitability(make())).toEqual({ score: null, coverage: 0 }));
  test("pondera encaje 3, disponibilidad 2 y adaptación 1", () => {
    expect(suitability(make({ tacticalFit: 80, availability: 60, adaptationRisk: 20 }))).toEqual({ score: 73, coverage: 1 });
  });
  test("con datos parciales usa solo lo que hay y baja la cobertura", () => {
    const result = suitability(make({ tacticalFit: 90 }));
    expect(result.score).toBe(90);
    expect(result.coverage).toBeCloseTo(0.5);
  });
});

describe("per90", () => {
  test("sin minutos no se calcula", () => expect(per90(make())).toMatchObject({ available: false, reason: expect.stringContaining("Sin minutos") }));
  test("muestra pequeña no se calcula", () => expect(per90(make({ minutes: 200, goals: 5 }))).toMatchObject({ available: false, minutes: 200 }));
  test("calcula por 90 con 2 decimales", () => expect(per90(make({ minutes: 900, goals: 10, assists: 5, progressiveActions: 45 }))).toEqual({ available: true, minutes: 900, goals: 1, assists: 0.5, progressive: 4.5 }));
  test("una métrica sin dato queda en null, no en 0", () => expect(per90(make({ minutes: 900, goals: 9 }))).toMatchObject({ goals: 0.9, assists: null, progressive: null }));
});

describe("squadAlerts", () => {
  test("contratos: ≤6 meses alta, ≤12 media", () => {
    const urgent = make({ contractEnd: inMonths(4) }), soon = make({ contractEnd: inMonths(10) }), fine = make();
    const alerts = squadAlerts([urgent, soon, fine, ...squad()]);
    expect(alerts.find((a) => a.playerId === urgent.id && a.title.includes("punto de vencer")).severity).toBe("high");
    expect(alerts.find((a) => a.playerId === soon.id && a.title.includes("último año")).severity).toBe("medium");
    expect(alerts.some((a) => a.playerId === fine.id && a.title.includes("Contrato"))).toBe(false);
  });
  test("disponibilidad baja, riesgo alto y edad", () => {
    const player = make({ availability: 20, adaptationRisk: 80, age: 35 });
    const titles = squadAlerts([player]).filter((a) => a.playerId === player.id).map((a) => a.title);
    expect(titles).toEqual(expect.arrayContaining(["Disponibilidad baja", "Riesgo de adaptación alto", "Edad avanzada"]));
  });
  test("poca profundidad por línea y orden por gravedad", () => {
    const alerts = squadAlerts([make({ pos: "MF" })]);
    expect(alerts.filter((a) => a.title.startsWith("Poca profundidad")).length).toBe(4);
    const rank = { high: 0, medium: 1, low: 2 };
    expect(alerts.map((a) => rank[a.severity])).toEqual([...alerts.map((a) => rank[a.severity])].sort((a, b) => a - b));
  });
  test("plantilla completa y valorada sin contratos cortos no genera alertas", () => {
    const full = squad().map((p) => ({ ...p, tacticalFit: 70, availability: 90, adaptationRisk: 20 }));
    expect(squadAlerts(full)).toEqual([]);
  });
  test("plantilla vacía no revienta", () => expect(squadAlerts([])).toEqual([]));
});

describe("squadBalance", () => {
  test("cuenta por línea y marca el estado", () => {
    const balance = squadBalance(squad());
    expect(balance.total).toBe(16);
    expect(balance.lines.map((l) => [l.group, l.count, l.status])).toEqual([["GK", 2, "ok"], ["DF", 5, "ok"], ["MF", 5, "ok"], ["FW", 4, "ok"]]);
  });
  test("detecta líneas vacías o cortas y no clasificados", () => {
    const balance = squadBalance([make({ pos: "DF" }), make({ pos: "??" })]);
    expect(balance.lines.find((l) => l.group === "GK").status).toBe("empty");
    expect(balance.lines.find((l) => l.group === "DF").status).toBe("low");
    expect(balance.unclassified).toBe(1);
  });
  test("cobertura de datos real", () => {
    const players = [make({ tacticalFit: 60, minutes: 800 }), make(), make(), make()];
    expect(squadBalance(players).dataCompleteness).toEqual({ rated: 25, withMinutes: 25 });
  });
  test("edad media por línea", () => expect(squadBalance([make({ pos: "FW", age: 20 }), make({ pos: "FW", age: 30 })]).lines.find((l) => l.group === "FW").averageAge).toBe(25));
});

describe("suggestLineup", () => {
  test("rellena cada línea según la formación con los mejor valorados", () => {
    const players = squad().map((p, i) => ({ ...p, tacticalFit: 50 + i, availability: 80 }));
    const lineup = suggestLineup(players, "4-4-2");
    expect(lineup.slots).toHaveLength(11);
    expect(lineup.slots.filter((s) => s.group === "DF")).toHaveLength(4);
    expect(lineup.slots.filter((s) => s.group === "FW")).toHaveLength(2);
    expect(lineup.warnings).toEqual([]);
    expect(new Set(lineup.slots.map((s) => s.playerId)).size).toBe(11);
    expect(lineup.bench).toHaveLength(5);
  });
  test("elige primero al mejor valorado de la línea", () => {
    const best = make({ pos: "FW", tacticalFit: 95, availability: 95 });
    const lineup = suggestLineup([make({ pos: "FW", tacticalFit: 40 }), best, make({ pos: "FW", tacticalFit: 60 }), make({ pos: "FW", tacticalFit: 55 })], "4-3-3");
    expect(lineup.slots.filter((s) => s.group === "FW")[0].playerId).toBe(best.id);
  });
  test("los sin valorar van detrás de los valorados", () => {
    const rated = make({ pos: "GK", tacticalFit: 30 }), unrated = make({ pos: "GK" });
    expect(suggestLineup([unrated, rated]).slots[0].playerId).toBe(rated.id);
  });
  test("avisa de los huecos y deja el puesto vacío", () => {
    const lineup = suggestLineup([make({ pos: "GK" })], "4-3-3");
    expect(lineup.slots.filter((s) => s.playerId === null)).toHaveLength(10);
    expect(lineup.warnings.length).toBe(3);
  });
  test("formación desconocida usa 4-3-3", () => expect(suggestLineup([], "9-9-9").slots).toHaveLength(Object.values(FORMATIONS["4-3-3"]).reduce((a, b) => a + b, 0)));
  test("todas las formaciones suman 11", () => { for (const [name, shape] of Object.entries(FORMATIONS)) expect([name, Object.values(shape).reduce((a, b) => a + b, 0)]).toEqual([name, 11]); });
});

describe("checkLineup", () => {
  test("detecta repetidos, fuera de línea, disponibilidad, contrato y sin valorar", () => {
    const df = make({ pos: "DF", availability: 20, contractEnd: inMonths(3) });
    const unrated = make({ pos: "MF" });
    const warnings = checkLineup([{ group: "DF", playerId: df.id }, { group: "DF", playerId: df.id }, { group: "FW", playerId: df.id }, { group: "MF", playerId: null }, { group: "MF", playerId: unrated.id }], [df, unrated]);
    const text = warnings.join("|");
    expect(text).toContain("repetido");
    expect(text).toContain("fuera de su línea");
    expect(text).toContain("disponibilidad baja");
    expect(text).toContain("termina contrato");
    expect(text).toContain("vacío");
    expect(text).toContain("no tiene valoración técnica");
  });
  test("un once correcto no avisa", () => {
    const gk = make({ pos: "GK", tacticalFit: 80, availability: 90, adaptationRisk: 10 });
    expect(checkLineup([{ group: "GK", playerId: gk.id }], [gk])).toEqual([]);
  });
});

describe("decisionMatrix", () => {
  const rated = (over) => make({ tacticalFit: 70, availability: 80, adaptationRisk: 30, ...over });
  test("ordena por puntuación con los pesos por defecto", () => {
    const strong = rated({ tacticalFit: 95 }), weak = rated({ tacticalFit: 40 });
    const rows = decisionMatrix([weak, strong]);
    expect(rows[0].id).toBe(strong.id);
    expect(rows[0].score).toBeGreaterThan(rows[1].score);
  });
  test("los pesos cambian el resultado", () => {
    const a = rated({ tacticalFit: 100, availability: 10 }), b = rated({ tacticalFit: 10, availability: 100 });
    expect(decisionMatrix([a, b], { ...DEFAULT_WEIGHTS, tacticalFit: 5, availability: 0 })[0].id).toBe(a.id);
    expect(decisionMatrix([a, b], { ...DEFAULT_WEIGHTS, tacticalFit: 0, availability: 5 })[0].id).toBe(b.id);
  });
  test("sin datos no inventa: criterios ausentes se excluyen e informan", () => {
    const [row] = decisionMatrix([make({ tacticalFit: 80 })]);
    expect(row.parts.goals90).toBeNull();
    expect(row.missing).toEqual(expect.arrayContaining(["Goles por 90'", "Disponibilidad"]));
    expect(row.coverage).toBeLessThan(100);
    expect(row.score).not.toBeNull();
  });
  test("per 90 es relativo al máximo de la plantilla", () => {
    const top = rated({ minutes: 900, goals: 18 }), half = rated({ minutes: 900, goals: 9 });
    const rows = Object.fromEntries(decisionMatrix([top, half]).map((r) => [r.id, r]));
    expect(rows[top.id].parts.goals90).toBe(100);
    expect(rows[half.id].parts.goals90).toBe(50);
  });
  test("muestra pequeña no puntúa en per 90", () => expect(decisionMatrix([rated({ minutes: 100, goals: 5 })])[0].parts.goals90).toBeNull());
  test("sin ningún dato disponible el score es null y va al final", () => {
    const empty = make({ age: null, contractEnd: inMonths(0) });
    const rows = decisionMatrix([empty, rated()], { ...DEFAULT_WEIGHTS, contract: 0, age: 0 });
    expect(rows.at(-1).id).toBe(empty.id);
    expect(rows.at(-1).score).toBeNull();
  });
  test("curva de edad: pico entre 24 y 29", () => {
    const score = (age) => decisionMatrix([make({ age })], { ...Object.fromEntries(CRITERIA.map((c) => [c.key, 0])), age: 1 })[0].score;
    expect(score(26)).toBe(100);
    expect(score(18)).toBeLessThan(score(24));
    expect(score(34)).toBeLessThan(score(29));
  });
  test("lista vacía", () => expect(decisionMatrix([])).toEqual([]));
});

describe("normalizeWeights", () => {
  test("limita a 0-5 y rellena lo que falta", () => {
    const weights = normalizeWeights({ tacticalFit: 99, availability: -4, goals90: "x" });
    expect(weights.tacticalFit).toBe(5);
    expect(weights.availability).toBe(0);
    expect(weights.goals90).toBe(DEFAULT_WEIGHTS.goals90);
    expect(Object.keys(weights).sort()).toEqual(Object.keys(DEFAULT_WEIGHTS).sort());
  });
});

describe("decisionFor / playerReport", () => {
  test("renovar: contrato corto y buena valoración", () => expect(decisionFor(make({ contractEnd: inMonths(8), tacticalFit: 85, availability: 90 })).label).toBe("Renovar"));
  test("no renovar: contrato corto y baja valoración", () => expect(decisionFor(make({ contractEnd: inMonths(8), tacticalFit: 30, availability: 40 })).label).toBe("No renovar / valorar salida"));
  test("contrato largo: seguir y valorar", () => expect(decisionFor(make({ tacticalFit: 90 })).label).toBe("Seguir y valorar"));
  test("sin valoración: no recomienda nada", () => expect(decisionFor(make({ contractEnd: inMonths(3) })).label).toBe("Sin datos suficientes"));
  test("el informe lista lo que falta y sus alertas", () => {
    const player = make({ pos: "FW", contractEnd: inMonths(4) });
    const report = playerReport(player);
    expect(report.group).toBe("FW");
    expect(report.missing).toEqual(expect.arrayContaining(["valoración técnica del staff", "minutos jugados", "rol en el equipo"]));
    expect(report.alerts.some((a) => a.title.includes("punto de vencer"))).toBe(true);
    expect(report.alerts.every((a) => a.playerId === player.id)).toBe(true);
  });
  test("informe completo no reclama datos", () => {
    const report = playerReport(make({ minutes: 1200, goals: 6, role: "Extremo", tacticalFit: 70, availability: 80, adaptationRisk: 20 }));
    expect(report.missing).toEqual([]);
    expect(report.per90.available).toBe(true);
  });
});
