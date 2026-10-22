import { describe, expect, test } from "bun:test";
import { MIN_PASSWORD, ONBOARDING_ERRORS, validateOnboarding } from "../lib/onboarding.js";

describe("validateOnboarding", () => {
  const ok = { name: "Ana Pérez", password: "una-clave-larga", confirm: "una-clave-larga" };

  test("acepta un nombre y una contraseña válidos", () => expect(validateOnboarding(ok)).toBeNull());
  test("el nombre es obligatorio y no puede pasar de 128", () => {
    expect(validateOnboarding({ ...ok, name: "   " })).toBe("name");
    expect(validateOnboarding({ ...ok, name: undefined })).toBe("name");
    expect(validateOnboarding({ ...ok, name: "x".repeat(129) })).toBe("name-long");
  });
  test("la contraseña tiene un mínimo y un máximo", () => {
    expect(validateOnboarding({ ...ok, password: "x".repeat(MIN_PASSWORD - 1), confirm: "x".repeat(MIN_PASSWORD - 1) })).toBe("password-short");
    expect(validateOnboarding({ ...ok, password: "x".repeat(MIN_PASSWORD), confirm: "x".repeat(MIN_PASSWORD) })).toBeNull();
    expect(validateOnboarding({ ...ok, password: "x".repeat(129), confirm: "x".repeat(129) })).toBe("password-long");
  });
  test("las dos contraseñas deben coincidir", () => {
    expect(validateOnboarding({ ...ok, confirm: "otra-distinta" })).toBe("mismatch");
    expect(validateOnboarding({ ...ok, confirm: undefined })).toBe("mismatch");
  });
  test("cada código de error tiene su mensaje (la URL solo lleva el código)", () => {
    for (const code of ["name", "name-long", "password-short", "password-long", "mismatch"]) expect(ONBOARDING_ERRORS[code]).toBeString();
    expect(ONBOARDING_ERRORS.link).toBeString();
  });
});
