import { beforeEach, describe, expect, test } from "bun:test";

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

describe("ui-store theme", () => {
  beforeEach(() => memory.clear());

  test("sin elección guardada sigue al navegador (system)", async () => {
    const { useUiStore } = await import("../lib/ui-store.js?fresh");
    expect(useUiStore.getState().theme).toBe("system");
  });

  test("descarta el 'light' por defecto que guardaba la versión anterior", async () => {
    memory.set("agentsolver-ui", JSON.stringify({ state: { sidebarCollapsed: true, theme: "light" }, version: 0 }));
    const { useUiStore } = await import("../lib/ui-store.js?migrated");
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().theme).toBe("system");
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  test("respeta la elección explícita de la versión actual", async () => {
    memory.set("agentsolver-ui", JSON.stringify({ state: { sidebarCollapsed: false, theme: "dark" }, version: 1 }));
    const { useUiStore } = await import("../lib/ui-store.js?explicit");
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().theme).toBe("dark");
  });
});
