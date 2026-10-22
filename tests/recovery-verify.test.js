import { beforeEach, describe, expect, mock, test } from "bun:test";

let updateRecoveryOTP;
const valid = `Ok-${crypto.randomUUID()}`;
const other = `No-${crypto.randomUUID()}`;
const tooShort = "c".repeat(5);
const challenge = { userId: "u1", secret: "654321", row: {} };

// bun comparte los mocks entre archivos de test y no permite añadir exports a un módulo ya
// mockeado: se deja completo para no romper a otros tests que importen el resto (p. ej. DB, Query).
const realAppwrite = { ...(await import("node-appwrite")) };
mock.module("node-appwrite", () => ({ ...realAppwrite, Account: class { updateRecoveryOTP(args) { return updateRecoveryOTP(args); } } }));
mock.module("../lib/appwrite.js", () => ({ adminClient: () => ({}), adminStorage: () => ({}), sessionClient: () => ({}), listAll: async () => [], APP_URL: "https://app.test", DB: "agentsolver", BUCKET_ID: "documents" }));
mock.module("../lib/recovery.js", () => ({
  getRecoveryChallenge: async (cookies) => (cookies.get("agentsolver_recovery_row") ? challenge : null),
  clearRecoveryCookies: (response) => response,
}));

const { POST } = await import("../app/api/auth/recovery/verify/route.js");

const request = (fields, { verified = true, challenged = true } = {}) => {
  const jar = { ...(challenged && { agentsolver_recovery_row: "1" }), ...(verified && { agentsolver_recovery_verified: "1" }) };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return { formData: async () => form, cookies: { get: (key) => (jar[key] ? { value: jar[key] } : undefined) } };
};
const location = (res) => res.headers.get("location");

describe("POST /api/auth/recovery/verify", () => {
  beforeEach(() => { updateRecoveryOTP = async () => ({}); });

  test("contraseña válida: cambia la contraseña y va al login", async () => {
    const res = await POST(request({ password: valid, passwordAgain: valid }));
    expect(location(res)).toBe("https://app.test/login?reset=success");
  });

  test("contraseñas distintas: sigue en el paso de contraseña (verified=1) con error mismatch", async () => {
    const res = await POST(request({ password: valid, passwordAgain: other }));
    expect(location(res)).toBe("https://app.test/forgot-password?sent=1&verified=1&error=mismatch");
  });

  test("contraseña corta: sigue en el paso de contraseña con error policy", async () => {
    const res = await POST(request({ password: tooShort, passwordAgain: tooShort }));
    expect(location(res)).toBe("https://app.test/forgot-password?sent=1&verified=1&error=policy");
  });

  test("Appwrite rechaza la contraseña (400): vuelve al paso de contraseña, no al del código", async () => {
    updateRecoveryOTP = async () => { throw Object.assign(new Error("Password is too common"), { code: 400 }); };
    const res = await POST(request({ password: other, passwordAgain: other }));
    expect(location(res)).toBe("https://app.test/forgot-password?sent=1&verified=1&error=policy");
  });

  test("código caducado (401): vuelve al paso del código", async () => {
    updateRecoveryOTP = async () => { throw Object.assign(new Error("Invalid token"), { code: 401 }); };
    const res = await POST(request({ password: valid, passwordAgain: valid }));
    expect(location(res)).toBe("https://app.test/forgot-password?sent=1&error=verify");
  });

  test("sin código verificado no cambia nada", async () => {
    const res = await POST(request({ password: valid, passwordAgain: valid }, { verified: false }));
    expect(location(res)).toBe("https://app.test/forgot-password?sent=1&error=verify");
  });
});
