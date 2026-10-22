import { describe, expect, test } from "bun:test";
import { INTEREST_LABEL, ownSignal, staffComments, teamSummary } from "../lib/staff-notes.js";

const signal = (userId, patch = {}) => ({ $id: `s-${userId}`, userId, userName: `Usuario ${userId}`, interest: "interested", notes: `nota de ${userId}`, updatedAt: "2026-03-01T10:00:00.000Z", ...patch });

describe("ownSignal", () => {
  const signals = [signal("ana"), signal("beto")];
  test("devuelve solo la valoración del propio usuario", () => {
    expect(ownSignal(signals, "beto").notes).toBe("nota de beto");
    expect(ownSignal(signals, "ana").notes).toBe("nota de ana");
  });
  test("sin valoración propia es null, aunque haya de otros", () => expect(ownSignal(signals, "carla")).toBeNull());
  test("sin usuario o sin lista no lanza ni devuelve la de otro", () => {
    expect(ownSignal(signals, undefined)).toBeNull();
    expect(ownSignal(signals, "")).toBeNull();
    expect(ownSignal(undefined, "ana")).toBeNull();
  });
});

describe("staffComments", () => {
  test("lista la nota, el estado, el autor y la fecha de cada miembro, lo más reciente primero", () => {
    const { opinions } = staffComments({ signals: [signal("ana", { updatedAt: "2026-01-01T00:00:00.000Z" }), signal("beto", { interest: "not-interested", updatedAt: "2026-02-01T00:00:00.000Z" })] });
    expect(opinions.map((item) => item.author)).toEqual(["Usuario beto", "Usuario ana"]);
    expect(opinions[0]).toMatchObject({ interest: "not-interested", label: "No interesa", notes: "nota de beto", date: "2026-02-01T00:00:00.000Z" });
  });
  test("omite lo que no aporta (por revisar y sin nota) pero conserva estado sin nota y nota sin estado", () => {
    const { opinions } = staffComments({ signals: [signal("a", { interest: "pending", notes: null }), signal("b", { interest: "interested", notes: null }), signal("c", { interest: "pending", notes: "ojo con la lesión" })] });
    expect(opinions.map((item) => item.id)).toEqual(["s-b", "s-c"]);
    expect(opinions.find((item) => item.id === "s-b").notes).toBeNull();
    expect(opinions.find((item) => item.id === "s-c").label).toBe(INTEREST_LABEL.pending);
  });
  test("un estado desconocido cae en 'por revisar' y sin autor se muestra un nombre genérico", () => {
    const { opinions } = staffComments({ signals: [signal("x", { interest: "raro", userName: "" })] });
    expect(opinions[0]).toMatchObject({ interest: "pending", author: "Miembro del staff" });
  });
  test("los movimientos llevan nota, coste y autor cuando se conoce; entrada por defecto", () => {
    const { moves } = staffComments({
      signals: [signal("ana")],
      targets: [
        { $id: "t1", direction: "out", club: "Milan", fee: 12, notes: "oferta verbal", createdBy: "ana", createdAt: "2026-04-01T00:00:00.000Z" },
        { $id: "t2", direction: "raro", club: "Ajax", fee: 0, notes: "", createdBy: "desconocido", createdAt: "2026-05-01T00:00:00.000Z" },
      ],
    });
    expect(moves.map((move) => move.id)).toEqual(["t2", "t1"]);
    expect(moves[0]).toMatchObject({ direction: "in", fee: null, notes: null, author: null });
    expect(moves[1]).toMatchObject({ direction: "out", fee: 12, notes: "oferta verbal", author: "Usuario ana" });
  });
  test("sin datos, o sin argumentos, devuelve listas vacías", () => {
    expect(staffComments()).toEqual({ opinions: [], moves: [] });
    expect(staffComments({ signals: [], targets: [] })).toEqual({ opinions: [], moves: [] });
  });
  test("lo que no tiene fecha va al final", () => {
    const { opinions } = staffComments({ signals: [signal("sin", { updatedAt: undefined }), signal("con")] });
    expect(opinions.map((item) => item.author)).toEqual(["Usuario con", "Usuario sin"]);
  });
});

describe("teamSummary", () => {
  const sig = (interest) => ({ interest });
  test("cuenta a favor y en contra, y no cuenta 'por revisar'", () => {
    expect(teamSummary([sig("interested"), sig("interested"), sig("not-interested"), sig("pending")])).toBe("Equipo: 2 a favor, 1 en contra");
  });
  test("solo muestra la parte que tiene votos", () => {
    expect(teamSummary([sig("interested")])).toBe("Equipo: 1 a favor");
    expect(teamSummary([sig("not-interested"), sig("not-interested")])).toBe("Equipo: 2 en contra");
  });
  test("sin votos, o sin datos, es cadena vacía", () => {
    expect(teamSummary([sig("pending")])).toBe("");
    expect(teamSummary([])).toBe("");
    expect(teamSummary(undefined)).toBe("");
  });
});
