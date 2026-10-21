import { describe, expect, test } from "bun:test";
import { chunk, mapLimit } from "../lib/async.js";

describe("chunk", () => {
  test("parte en trozos y conserva todo", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
  test("100 por defecto (límite de Query.equal de Appwrite)", () => expect(chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length)).toEqual([100, 100, 50]));
});

describe("mapLimit", () => {
  test("respeta el orden de salida", async () => {
    const out = await mapLimit([30, 5, 15], 2, async (ms) => { await new Promise((r) => setTimeout(r, ms)); return ms; });
    expect(out).toEqual([30, 5, 15]);
  });
  test("nunca supera el límite de concurrencia", async () => {
    let running = 0, peak = 0;
    await mapLimit(Array.from({ length: 12 }, (_, i) => i), 3, async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--; });
    expect(peak).toBe(3);
  });
  test("lista vacía", async () => expect(await mapLimit([], 4, async () => 1)).toEqual([]));
  test("propaga el error", async () => { await expect(mapLimit([1], 1, async () => { throw new Error("boom"); })).rejects.toThrow("boom"); });
});
