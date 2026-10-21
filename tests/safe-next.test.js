import { describe, expect, test } from "bun:test";
import { safeNext } from "../lib/safe-next.js";

describe("safeNext (anti open-redirect)", () => {
  test("acepta rutas internas con query", () => expect(safeNext("/mcp/oauth?a=1&b=2")).toBe("/mcp/oauth?a=1&b=2"));
  test.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil", "", undefined, null, 42])("rechaza %p", (value) => expect(safeNext(value)).toBe("/"));
  test("usa el fallback indicado", () => expect(safeNext("//x", "/login")).toBe("/login"));
});
