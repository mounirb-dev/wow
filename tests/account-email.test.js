import { beforeEach, describe, expect, mock, test } from "bun:test";

let updateEmail;
let deleteSession;
let createVerification;
let updateVerification;
let rows;
const updated = [];
const password = `Ok-${crypto.randomUUID()}`;

// bun comparte los mocks entre archivos de test: se deja el módulo real completo y solo se sustituye lo que toca la red.
const realAppwrite = { ...(await import("node-appwrite")) };
mock.module("node-appwrite", () => ({
  ...realAppwrite,
  Account: class {
    updateEmail(args) { return updateEmail(args); }
    deleteSession(args) { return deleteSession(args); }
    createVerification(args) { return createVerification(args); }
    updateVerification(args) { return updateVerification(args); }
  },
  TablesDB: class { listRows() { return Promise.resolve({ rows }); } updateRow(_db, _table, id, data) { updated.push([id, data]); return Promise.resolve({}); } },
}));
mock.module("../lib/appwrite.js", () => ({ adminClient: () => ({}), adminStorage: () => ({}), sessionClient: () => ({}), listAll: async () => [], APP_URL: "https://app.test", DB: "agentsolver", BUCKET_ID: "documents" }));

const { POST: changeEmail } = await import("../app/api/account/email/route.js");
const { POST: logout } = await import("../app/api/auth/logout/route.js");
const { GET: verifyEmail } = await import("../app/api/account/email/verify/route.js");
const { POST: resend } = await import("../app/api/account/email/resend/route.js");

const request = (body, { cookie = true } = {}) => ({ json: async () => body, cookies: { get: (key) => (cookie && key === "as_session" ? { value: "secret" } : undefined) } });

describe("POST /api/account/email", () => {
  beforeEach(() => {
    updated.length = 0;
    rows = [{ $id: "member1" }];
    updateEmail = async ({ email }) => ({ $id: "u1", email });
    createVerification = async () => ({});
  });

  test("cambia el email (en minúsculas), actualiza sus membresías y manda el enlace de verificación", async () => {
    let verification;
    createVerification = async (args) => { verification = args; };
    const res = await changeEmail(request({ email: "  Nuevo@Club.com ", password }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "nuevo@club.com", verificationSent: true });
    expect(updated).toEqual([["member1", { email: "nuevo@club.com" }]]);
    expect(verification).toEqual({ url: "https://app.test/api/account/email/verify" });
  });

  test("si no sale el email de verificación, el cambio vale y se avisa con verificationSent:false", async () => {
    createVerification = async () => { throw new Error("sin SMTP"); };
    const res = await changeEmail(request({ email: "a@b.com", password }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "a@b.com", verificationSent: false });
  });

  test("sin sesión: 401 y no toca nada", async () => {
    const res = await changeEmail(request({ email: "a@b.com", password }, { cookie: false }));
    expect(res.status).toBe(401);
    expect(updated).toEqual([]);
  });

  test("email no válido o sin contraseña: 400 sin llamar a Appwrite", async () => {
    updateEmail = async () => { throw new Error("no debería llamarse"); };
    expect((await changeEmail(request({ email: "no-es-email", password }))).status).toBe(400);
    expect((await changeEmail(request({ email: "a@b.com", password: "" }))).status).toBe(400);
  });

  test("email ya usado (409) y contraseña incorrecta (401) dan su mensaje", async () => {
    updateEmail = async () => { throw Object.assign(new Error("exists"), { code: 409 }); };
    const taken = await changeEmail(request({ email: "a@b.com", password }));
    expect(taken.status).toBe(409);
    updateEmail = async () => { throw Object.assign(new Error("bad"), { code: 401 }); };
    const wrong = await changeEmail(request({ email: "a@b.com", password }));
    expect(wrong.status).toBe(401);
    expect(updated).toEqual([]);
  });

  test("si falla actualizar las membresías, el cambio de email sigue valiendo", async () => {
    rows = null; // listRows devuelve { rows: null } y desestructurar .map lanza
    const res = await changeEmail(request({ email: "a@b.com", password }));
    expect(res.status).toBe(200);
  });
});

describe("verificación del email", () => {
  const link = (query) => ({ nextUrl: new URL(`https://app.test/api/account/email/verify${query}`) });

  test("enlace válido: verifica y enseña email-confirmado ok=1", async () => {
    let args;
    updateVerification = async (value) => { args = value; };
    const res = await verifyEmail(link("?userId=u1&secret=s1"));
    expect(args).toEqual({ userId: "u1", secret: "s1" });
    expect(res.headers.get("location")).toBe("https://app.test/email-confirmado?ok=1");
  });

  test("enlace caducado o incompleto: ok=0, y sin parámetros ni se llama a Appwrite", async () => {
    updateVerification = async () => { throw Object.assign(new Error("expired"), { code: 401 }); };
    expect((await verifyEmail(link("?userId=u1&secret=s1"))).headers.get("location")).toBe("https://app.test/email-confirmado?ok=0");
    updateVerification = async () => { throw new Error("no debería llamarse"); };
    expect((await verifyEmail(link(""))).headers.get("location")).toBe("https://app.test/email-confirmado?ok=0");
  });

  test("reenviar: necesita sesión y devuelve 500 si Appwrite no puede enviar", async () => {
    createVerification = async () => ({});
    expect((await resend(request({}, { cookie: false }))).status).toBe(401);
    expect((await resend(request({}))).status).toBe(200);
    createVerification = async () => { throw new Error("límite"); };
    expect((await resend(request({}))).status).toBe(500);
  });
});

describe("POST /api/auth/logout", () => {
  test("cierra la sesión en Appwrite, borra la cookie y va al login", async () => {
    let args;
    deleteSession = async (value) => { args = value; };
    const res = await logout(request({}));
    expect(args).toEqual({ sessionId: "current" });
    expect(res.headers.get("location")).toBe("https://app.test/login");
    expect(res.headers.get("set-cookie")).toContain("as_session=;");
  });

  test("aunque Appwrite falle, la cookie se borra igualmente", async () => {
    deleteSession = async () => { throw new Error("caducada"); };
    const res = await logout(request({}));
    expect(res.headers.get("location")).toBe("https://app.test/login");
    expect(res.headers.get("set-cookie")).toContain("as_session=;");
  });
});
