import { describe, expect, test } from "bun:test";
import { commission, curve, fmtM, leverage, monthsLeft, negotiate, portfolio } from "../lib/tools.js";

const inMonths = (n) => new Date(Date.now() + n * 30.44 * 864e5).toISOString();
const player = (over = {}) => ({ id: "p", age: 25, contractEnd: inMonths(24), value: 50, salary: 5, fair: 8, momentum: 0.5, suitors: [{ club: "A", need: 80 }], ...over });

describe("monthsLeft", () => {
  test("cuenta meses y nunca baja de 0", () => {
    expect(monthsLeft(player({ contractEnd: inMonths(12) }))).toBe(12);
    expect(monthsLeft(player({ contractEnd: inMonths(-5) }))).toBe(0);
  });
  test("usa la hora actual, no la del arranque del módulo", () => {
    const realNow = Date.now;
    const target = player({ contractEnd: inMonths(12) });
    try {
      Date.now = () => realNow() + 6 * 30.44 * 864e5;
      expect(monthsLeft(target)).toBe(6);
    } finally { Date.now = realNow; }
  });
});

describe("leverage", () => {
  test("sube cuanto menos contrato queda", () => {
    expect(leverage(player({ contractEnd: inMonths(4) }))).toBeGreaterThan(leverage(player({ contractEnd: inMonths(40) })));
  });
  test("siempre entre 0 y 100", () => {
    for (const months of [0, 3, 9, 15, 24, 60]) for (const momentum of [0, 0.5, 1]) {
      const value = leverage(player({ contractEnd: inMonths(months), momentum, age: 35 }));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe("negociación", () => {
  test("la comisión es salario × años × porcentaje", () => expect(commission(10, 3, 0.05)).toBeCloseTo(1.5));
  test("probabilidad de cierre dentro de [0,1] y comisión esperada coherente", () => {
    const result = negotiate(player(), { need: 80 }, 8);
    expect(result.pDeal).toBeGreaterThanOrEqual(0);
    expect(result.pDeal).toBeLessThanOrEqual(1);
    expect(result.ev).toBeCloseTo(result.pDeal * result.comm);
  });
  test("pedir mucho más que el máximo del club hunde la probabilidad", () => {
    expect(negotiate(player(), { need: 80 }, 40).pDeal).toBeLessThan(0.01);
  });
  test("curve devuelve el punto de mayor comisión esperada", () => {
    const { pts, best } = curve(player(), { need: 80 });
    expect(pts).toHaveLength(48);
    expect(best.ev).toBe(Math.max(...pts.map((point) => point.ev)));
  });
});

describe("portfolio", () => {
  test("agrega valor, caducidades y pipeline", () => {
    const result = portfolio([player({ value: 10, contractEnd: inMonths(6) }), player({ value: 20, suitors: [] })]);
    expect(result.aum).toBe(30);
    expect(result.count).toBe(2);
    expect(result.expiring).toBe(1);
    expect(result.pipeline).toBeGreaterThan(0);
  });
  test("cartera vacía no revienta", () => expect(portfolio([])).toEqual({ aum: 0, count: 0, expiring: 0, pipeline: 0 }));
});

describe("fmtM", () => {
  test("0 significa pendiente", () => { expect(fmtM(0)).toBe("Pendiente"); expect(fmtM(12.34)).toBe("€12.3M"); });
});
