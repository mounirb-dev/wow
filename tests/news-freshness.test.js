import { describe, expect, test } from "bun:test";
import { NEWS_MAX_AGE_MS, isNewsStale, lastFetchedAt } from "../lib/news-freshness.js";

const at = (ms) => ({ fetchedAt: new Date(ms).toISOString() });
const now = Date.parse("2026-10-22T12:00:00Z");

describe("lastFetchedAt", () => {
  test("la descarga más reciente", () => expect(lastFetchedAt([at(now - 5000), at(now - 1000), at(now - 9000)])).toBe(now - 1000));
  test("ignora fechas ausentes o inválidas", () => expect(lastFetchedAt([{}, { fetchedAt: "no-es-fecha" }, at(now)])).toBe(now));
  test("sin noticias es null", () => expect(lastFetchedAt([])).toBeNull());
});

describe("isNewsStale", () => {
  test("sin noticias está desfasado", () => expect(isNewsStale([], now)).toBe(true));
  test("recientes no", () => expect(isNewsStale([at(now - 10 * 60e3)], now)).toBe(false));
  test("justo en el límite de una hora aún vale; un poco más ya no", () => {
    expect(isNewsStale([at(now - NEWS_MAX_AGE_MS)], now)).toBe(false);
    expect(isNewsStale([at(now - NEWS_MAX_AGE_MS - 1)], now)).toBe(true);
  });
  test("cuenta la descarga más reciente, no la primera", () => expect(isNewsStale([at(now - 5 * 3600e3), at(now - 60e3)], now)).toBe(false));
  test("noticias sin fetchedAt cuentan como desfasadas", () => expect(isNewsStale([{ $id: "x" }], now)).toBe(true));
});
