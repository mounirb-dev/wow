import { beforeEach, describe, expect, mock, test } from "bun:test";

// Aislamiento multi-tenant (docs/arquitectura.md): Appwrite se usa con la API key de admin, que no
// aplica permisos por fila, así que cada lectura/escritura debe filtrar o verificar el workspace.
// Aquí se levanta una base en memoria con DOS workspaces y se comprueba que un usuario del A
// no puede leer ni tocar nada del B por ninguna ruta.

process.env.APPWRITE_ENDPOINT = "https://appwrite.test/v1";
process.env.APPWRITE_PROJECT_ID = "test";
process.env.APPWRITE_API_KEY = "test";

const real = { ...(await import("node-appwrite")) };

let store;
let currentUser;
const storageCalls = { created: [], deleted: [], downloaded: [], previewed: [] };

const notFound = () => Object.assign(new Error("Row not found"), { code: 404 });

class FakeTablesDB {
  async getRow(_db, table, id) {
    const row = store[table]?.[id];
    if (!row) throw notFound();
    return structuredClone(row);
  }
  async listRows(_db, table, queries = []) {
    const parsed = queries.map((query) => JSON.parse(String(query)));
    let rows = Object.values(store[table] ?? {});
    for (const { method, attribute, values } of parsed) {
      if (method === "equal") rows = rows.filter((row) => values.includes(row[attribute]));
    }
    const total = rows.length;
    const cursor = parsed.find((query) => query.method === "cursorAfter")?.values[0];
    if (cursor) rows = rows.slice(rows.findIndex((row) => row.$id === cursor) + 1);
    const limit = parsed.find((query) => query.method === "limit")?.values[0] ?? 25;
    return { total, rows: structuredClone(rows.slice(0, limit)) };
  }
  async createRow(_db, table, id, data) {
    store[table] ??= {};
    if (store[table][id]) throw Object.assign(new Error("exists"), { code: 409 });
    return structuredClone((store[table][id] = { $id: id, ...data }));
  }
  async updateRow(_db, table, id, data) {
    if (!store[table]?.[id]) throw notFound();
    return structuredClone(Object.assign(store[table][id], data));
  }
  async deleteRow(_db, table, id) {
    if (!store[table]?.[id]) throw notFound();
    delete store[table][id];
  }
}

class FakeStorage {
  async createFile(_bucket, id, file) { storageCalls.created.push({ id, name: file?.filename, isInputFile: typeof file?.size === "function" }); return {}; }
  async deleteFile(_bucket, id) { storageCalls.deleted.push(id); }
  async getFileDownload(_bucket, id) { storageCalls.downloaded.push(id); return Buffer.from("contenido"); }
  async getFilePreview(_bucket, id) { storageCalls.previewed.push(id); return Buffer.from("png"); }
}

mock.module("node-appwrite", () => ({ ...real, TablesDB: FakeTablesDB, Storage: FakeStorage }));
// bun comparte los mocks entre archivos de test (recovery-verify.test.js ya sustituye este módulo
// con solo dos exports), así que se redefine completo en vez de importar el real.
mock.module("../lib/appwrite.js", () => ({
  adminClient: () => ({}),
  adminStorage: () => new FakeStorage(),
  sessionClient: () => ({}),
  APP_URL: "https://app.test",
  DB: "agentsolver",
  BUCKET_ID: "documents",
  async listAll(db, table, queries = [], { max = 5000 } = {}) {
    const rows = [];
    let cursor;
    while (rows.length < max) {
      const page = await db.listRows("agentsolver", table, [...queries, real.Query.limit(100), ...(cursor ? [real.Query.cursorAfter(cursor)] : [])]);
      rows.push(...page.rows);
      if (page.rows.length < 100) break;
      cursor = page.rows.at(-1).$id;
    }
    return rows;
  },
}));
mock.module("next/cache", () => ({ unstable_cache: (fn) => fn, revalidateTag: () => {} }));
mock.module("../lib/session.js", () => ({ COOKIE: "as_session", cookieOptions: {}, getUser: async () => currentUser, requireUser: async () => currentUser }));

const { loadPlayer, loadPlayers, loadPlayersFor } = await import("../lib/data.js");
const { loadStaffDataByPlayer } = await import("../lib/staff-data.js");
const { loadAllNews, loadPlayerNews, refreshNewsIfStale } = await import("../lib/news-sync.js");
const { resolveWorkspaceContext } = await import("../lib/workspace.js");
const players = await import("../app/api/players/[id]/route.js");
const staff = await import("../app/api/players/[id]/staff/route.js");
const targets = await import("../app/api/transfer-targets/route.js");
const members = await import("../app/api/workspace/members/route.js");
const member = await import("../app/api/workspace/members/[id]/route.js");
const folders = await import("../app/api/workspace/folders/route.js");
const folder = await import("../app/api/workspace/folders/[id]/route.js");
const files = await import("../app/api/workspace/folders/[id]/files/route.js");
const file = await import("../app/api/workspace/folders/[id]/files/[fileId]/route.js");
const allFiles = await import("../app/api/workspace/files/route.js");
const icon = await import("../app/api/workspace/icon/route.js");
const club = await import("../app/api/workspace/club/route.js");
const newsSync = await import("../app/api/news/sync/route.js");

const users = {
  editorA: { $id: "u-editor-a", email: "editor@a.test", name: "Editor A" },
  viewerA: { $id: "u-viewer-a", email: "viewer@a.test", name: "Viewer A" },
  adminA: { $id: "u-admin-a", email: "admin@a.test", name: "Admin A" },
  ownerB: { $id: "u-owner-b", email: "owner@b.test", name: "Owner B" },
  stranger: { $id: "u-stranger", email: "stranger@c.test", name: "Stranger" },
};
const as = (user) => { currentUser = user; };

function seed() {
  const table = (rows) => Object.fromEntries(rows.map((row) => [row.$id, row]));
  const player = (id, workspaceId) => ({ $id: id, workspaceId, name: `Jugador ${id}`, age: 24, pos: "MF", club: "Club", contractEnd: "2027-06-30T00:00:00.000Z", value: 10, salary: 1, fair: 1, momentum: 0.5, seed: 1, staffNotes: "original" });
  store = {
    workspaces: table([{ $id: "wsA", name: "A", iconFileId: "iconA" }, { $id: "wsB", name: "B", iconFileId: "iconB" }]),
    workspace_members: table([
      { $id: "mEditorA", workspaceId: "wsA", userId: users.editorA.$id, email: users.editorA.email, role: "editor", status: "active" },
      { $id: "mViewerA", workspaceId: "wsA", userId: users.viewerA.$id, email: users.viewerA.email, role: "viewer", status: "active" },
      { $id: "mAdminA", workspaceId: "wsA", userId: users.adminA.$id, email: users.adminA.email, role: "admin", status: "active" },
      { $id: "mOwnerB", workspaceId: "wsB", userId: users.ownerB.$id, email: users.ownerB.email, role: "owner", status: "active" },
      { $id: "mOtherB", workspaceId: "wsB", userId: "u-other-b", email: "other@b.test", role: "editor", status: "active" },
    ]),
    players: table([player("pA", "wsA"), player("pB", "wsB")]),
    suitors: table([{ $id: "sA", playerId: "pA", club: "Club de A", need: 50 }, { $id: "sB", playerId: "pB", club: "Club de B", need: 90 }]),
    player_staff_signals: table([{ $id: "sigB", workspaceId: "wsB", playerId: "pB", userId: "u-other-b", interest: "interested" }, { $id: "sigA", workspaceId: "wsA", playerId: "pA", userId: users.viewerA.$id, interest: "pending" }]),
    transfer_targets: table([{ $id: "tgtB", workspaceId: "wsB", playerId: "pB", club: "Secreto B", createdAt: "2026-01-01" }, { $id: "tgtA", workspaceId: "wsA", playerId: "pA", club: "Visible A", createdAt: "2026-01-01" }]),
    news_items: table([{ $id: "nA", playerId: "pA", title: "Noticia A", publishedAt: "2026-01-02" }, { $id: "nB", playerId: "pB", title: "Noticia B", publishedAt: "2026-01-03" }]),
    folders: table([
      { $id: "fA", workspaceId: "wsA", name: "Carpeta A", parentId: null, createdBy: users.editorA.$id },
      { $id: "fOpen", workspaceId: "wsA", name: "Abierta", parentId: null, createdBy: users.adminA.$id },
      // Restringida a viewerA (más owner/admin y su creador); la hija hereda la restricción.
      { $id: "fSecret", workspaceId: "wsA", name: "Secreta", parentId: null, createdBy: users.adminA.$id, restricted: true, allowedUserIds: [users.viewerA.$id] },
      { $id: "fSecretChild", workspaceId: "wsA", name: "Hija secreta", parentId: "fSecret", createdBy: users.adminA.$id },
      { $id: "fB", workspaceId: "wsB", name: "Carpeta B", parentId: null },
    ]),
    documents: table([
      { $id: "dA", workspaceId: "wsA", folderId: "fA", name: "a.pdf", mimeType: "application/pdf", storageFileId: "binA" },
      { $id: "dSecret", workspaceId: "wsA", folderId: "fSecret", name: "secreto.pdf", mimeType: "application/pdf", storageFileId: "binSecret" },
      { $id: "dChild", workspaceId: "wsA", folderId: "fSecretChild", name: "hija.pdf", mimeType: "application/pdf", storageFileId: "binChild" },
      { $id: "dB", workspaceId: "wsB", folderId: "fB", name: "b.pdf", mimeType: "application/pdf", storageFileId: "binB" },
    ]),
  };
  storageCalls.created.length = storageCalls.deleted.length = storageCalls.downloaded.length = storageCalls.previewed.length = 0;
  as(users.editorA);
}

const json = (method, body) => new Request("https://app.test/api", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
const params = (value) => ({ params: Promise.resolve(value) });

beforeEach(seed);

describe("aislamiento: lecturas", () => {
  test("loadPlayers solo devuelve jugadores y pretendientes del propio workspace", async () => {
    const list = await loadPlayers();
    expect(list.map((p) => p.id)).toEqual(["pA"]);
    expect(list[0].suitors).toEqual([{ club: "Club de A", need: 50 }]);
  });

  test("loadPlayer de un jugador de otro workspace devuelve null (igual que si no existiera)", async () => {
    expect(await loadPlayer("pB")).toBeNull();
    expect(await loadPlayer("no-existe")).toBeNull();
    expect((await loadPlayer("pA")).id).toBe("pA");
  });

  test("valoraciones y movimientos del staff: solo los del workspace", async () => {
    const byPlayer = await loadStaffDataByPlayer();
    expect(Object.keys(byPlayer)).toEqual(["pA"]);
    expect(byPlayer.pA.targets.map((t) => t.club)).toEqual(["Visible A"]);
  });

  test("noticias: no se leen las de un jugador ajeno, ni en la ficha ni en el listado global", async () => {
    expect(await loadPlayerNews("pB")).toEqual([]);
    expect((await loadPlayerNews("pA")).map((n) => n.$id)).toEqual(["nA"]);
    expect((await loadAllNews()).map((n) => n.$id)).toEqual(["nA"]);
  });

  test("sin sesión no se carga nada", async () => {
    as(null);
    expect(await loadPlayers()).toEqual([]);
    expect(await loadStaffDataByPlayer()).toEqual({});
    expect(await loadAllNews()).toEqual([]);
  });

  test("un usuario sin membresía recibe un workspace propio y vacío, nunca uno existente", async () => {
    as(users.stranger);
    const context = await resolveWorkspaceContext(users.stranger);
    expect(["wsA", "wsB"]).not.toContain(context.workspace.$id);
    expect(context.member.role).toBe("owner");
    expect(await loadPlayersFor(context)).toEqual([]);
  });

  test("MCP: loadPlayersFor con el usuario de B solo ve a B", async () => {
    const context = await resolveWorkspaceContext(users.ownerB);
    expect((await loadPlayersFor(context)).map((p) => p.id)).toEqual(["pB"]);
  });

  test("GET miembros y carpetas listan solo el propio workspace", async () => {
    const membersList = await (await members.GET()).json();
    expect(membersList.members.map((m) => m.$id).sort()).toEqual(["mAdminA", "mEditorA", "mViewerA"]);
    const foldersList = await (await folders.GET()).json();
    expect(foldersList.folders.map((f) => f.$id).sort()).toEqual(["fA", "fOpen"]);
  });

  test("el icono servido es el del propio workspace", async () => {
    expect((await icon.GET()).status).toBe(200);
    expect(storageCalls.previewed).toEqual(["iconA"]);
  });
});

describe("aislamiento: escrituras y acceso por id", () => {
  test("PATCH de un jugador de otro workspace: 404 y sin cambios", async () => {
    const res = await players.PATCH(json("PATCH", { staffNotes: "pisado" }), params({ id: "pB" }));
    expect(res.status).toBe(404);
    expect(store.players.pB.staffNotes).toBe("original");
  });

  test("PATCH del propio jugador funciona y un viewer recibe 403", async () => {
    expect((await players.PATCH(json("PATCH", { staffNotes: "nuevo" }), params({ id: "pA" }))).status).toBe(200);
    expect(store.players.pA.staffNotes).toBe("nuevo");
    as(users.viewerA);
    expect((await players.PATCH(json("PATCH", { staffNotes: "otro" }), params({ id: "pA" }))).status).toBe(403);
    expect(store.players.pA.staffNotes).toBe("nuevo");
  });

  test("movimiento de fichaje sobre un jugador ajeno: 404 y no se crea nada", async () => {
    const before = Object.keys(store.transfer_targets).length;
    const res = await targets.POST(json("POST", { playerId: "pB", club: "Intruso" }));
    expect(res.status).toBe(404);
    expect(Object.keys(store.transfer_targets)).toHaveLength(before);
  });

  test("valoración del staff sobre un jugador ajeno: 404 y no se crea nada", async () => {
    const before = Object.keys(store.player_staff_signals).length;
    const res = await staff.PATCH(json("PATCH", { interest: "interested", notes: "x" }), params({ id: "pB" }));
    expect(res.status).toBe(404);
    expect(Object.keys(store.player_staff_signals)).toHaveLength(before);
    expect(Object.values(store.player_staff_signals).some((s) => s.playerId === "pB" && s.workspaceId === "wsA")).toBe(false);
  });

  test("valoración sobre un jugador propio se guarda con el workspace del usuario", async () => {
    const res = await staff.PATCH(json("PATCH", { interest: "interested", notes: "bien" }), params({ id: "pA" }));
    expect(res.status).toBe(200);
    expect(Object.values(store.player_staff_signals).find((s) => s.userId === users.editorA.$id && s.playerId === "pA")).toMatchObject({ workspaceId: "wsA", interest: "interested" });
  });

  test("miembros: un admin de A no puede cambiar ni expulsar a miembros de B", async () => {
    store.workspace_members.mEditorA.role = "admin";
    expect((await member.PATCH(json("PATCH", { role: "viewer" }), params({ id: "mOtherB" }))).status).toBe(404);
    expect((await member.DELETE(json("DELETE"), params({ id: "mOtherB" }))).status).toBe(404);
    expect(store.workspace_members.mOtherB.role).toBe("editor");
  });

  test("miembros: un id inexistente responde igual que uno ajeno (404), sin lanzar", async () => {
    store.workspace_members.mEditorA.role = "admin";
    expect((await member.PATCH(json("PATCH", { role: "viewer" }), params({ id: "no-existe" }))).status).toBe(404);
    expect((await member.DELETE(json("DELETE"), params({ id: "no-existe" }))).status).toBe(404);
  });

  test("miembros: nadie puede asignar el rol owner, ni invitando ni cambiando rol", async () => {
    store.workspace_members.mEditorA.role = "admin";
    const before = Object.keys(store.workspace_members).length;
    expect((await member.PATCH(json("PATCH", { role: "owner" }), params({ id: "mEditorA" }))).status).toBe(400);
    expect((await member.PATCH(json("PATCH", { role: "owner" }), params({ id: "mViewerA" }))).status).toBe(400);
    expect((await members.POST(json("POST", { email: "nuevo@a.test", role: "owner" }))).status).toBe(400);
    expect(store.workspace_members.mEditorA.role).toBe("admin");
    expect(store.workspace_members.mViewerA.role).toBe("viewer");
    expect(Object.keys(store.workspace_members)).toHaveLength(before);
  });

  test("miembros: un admin sí puede cambiar un rol a viewer", async () => {
    store.workspace_members.mEditorA.role = "admin";
    expect((await member.PATCH(json("PATCH", { role: "viewer" }), params({ id: "mViewerA" }))).status).toBe(200);
  });

  test("carpetas: no se puede crear dentro de una carpeta de otro workspace", async () => {
    const before = Object.keys(store.folders).length;
    expect((await folders.POST(json("POST", { name: "Intrusa", parentId: "fB" }))).status).toBe(400);
    // Una carpeta padre inexistente responde igual que una ajena.
    expect((await folders.POST(json("POST", { name: "Intrusa", parentId: "no-existe" }))).status).toBe(400);
    expect(Object.keys(store.folders)).toHaveLength(before);
  });

  test("carpetas: renombrar o mover una carpeta ajena o inexistente da 404/400 y no tiene efecto", async () => {
    expect((await folder.PATCH(json("PATCH", { name: "Pisada" }), params({ id: "fB" }))).status).toBe(404);
    expect((await folder.PATCH(json("PATCH", { name: "Pisada" }), params({ id: "no-existe" }))).status).toBe(404);
    expect((await folder.PATCH(json("PATCH", { parentId: "fB" }), params({ id: "fA" }))).status).toBe(400);
    expect((await folder.PATCH(json("PATCH", { parentId: "no-existe" }), params({ id: "fA" }))).status).toBe(400);
    expect(store.folders.fB.name).toBe("Carpeta B");
    expect(store.folders.fA.parentId).toBeNull();
  });

  test("archivos: listar, descargar y borrar documentos ajenos da 404 y no toca el almacenamiento", async () => {
    expect((await files.GET(json("GET"), params({ id: "fB" }))).status).toBe(404);
    expect((await file.GET(json("GET"), params({ id: "fB", fileId: "dB" }))).status).toBe(404);
    // Truco: pedir el documento de B colgando de una carpeta propia.
    expect((await file.GET(json("GET"), params({ id: "fA", fileId: "dB" }))).status).toBe(404);
    expect((await file.DELETE(json("DELETE"), params({ id: "fA", fileId: "dB" }))).status).toBe(404);
    expect((await file.DELETE(json("DELETE"), params({ id: "fB", fileId: "dB" }))).status).toBe(404);
    expect(storageCalls.downloaded).toEqual([]);
    expect(storageCalls.deleted).toEqual([]);
    expect(store.documents.dB).toBeDefined();
  });

  test("archivos propios: se listan y se descargan", async () => {
    const list = await (await files.GET(json("GET"), params({ id: "fA" }))).json();
    expect(list.files.map((f) => f.$id)).toEqual(["dA"]);
    expect((await (await allFiles.GET()).json()).files.map((f) => f.$id)).toEqual(["dA"]);
    expect((await file.GET(json("GET"), params({ id: "fA", fileId: "dA" }))).status).toBe(200);
    expect(storageCalls.downloaded).toEqual(["binA"]);
  });

  test("sin sesión todas las rutas responden 401", async () => {
    as(null);
    expect((await players.PATCH(json("PATCH", { staffNotes: "x" }), params({ id: "pA" }))).status).toBe(401);
    expect((await staff.PATCH(json("PATCH", {}), params({ id: "pA" }))).status).toBe(401);
    expect((await targets.POST(json("POST", {}))).status).toBe(401);
    expect((await members.GET()).status).toBe(401);
    expect((await folders.GET()).status).toBe(401);
    expect((await file.GET(json("GET"), params({ id: "fA", fileId: "dA" }))).status).toBe(401);
  });
});

describe("aislamiento: sincronización de noticias", () => {
  const synced = async (request) => (await (await newsSync.POST(request)).json()).results.map((r) => r.playerId).sort();
  const withFeed = async (run) => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response("<rss><channel></channel></rss>");
    try { return await run(); } finally { globalThis.fetch = original; }
  };

  test("con sesión solo se sincronizan los jugadores del propio workspace", async () => {
    expect(await withFeed(() => synced(new Request("https://app.test/api/news/sync", { method: "POST" })))).toEqual(["pA"]);
  });

  test("sin sesión ni secreto: 401", async () => {
    as(null);
    expect((await newsSync.POST(new Request("https://app.test/api/news/sync", { method: "POST" }))).status).toBe(401);
  });

  test("Vercel Cron: GET con CRON_SECRET sincroniza todo; sin secreto o con sesión de usuario no", async () => {
    process.env.CRON_SECRET = "secreto-vercel";
    try {
      const get = (headers) => new Request("https://app.test/api/news/sync", { method: "GET", headers });
      expect(await withFeed(async () => (await (await newsSync.GET(get({ authorization: "Bearer secreto-vercel" }))).json()).results.map((r) => r.playerId).sort())).toEqual(["pA", "pB"]);
      expect((await newsSync.GET(get({ authorization: "Bearer otro" }))).status).toBe(401);
      expect((await newsSync.GET(get({}))).status).toBe(401);
      // Con sesión de usuario, un GET (que cualquier página ajena podría provocar) tampoco sincroniza.
      expect((await newsSync.GET(get({}))).status).toBe(401);
    } finally { delete process.env.CRON_SECRET; }
  });

  test("el secreto del cron sincroniza todos los workspaces; uno incorrecto no", async () => {
    process.env.NEWS_SYNC_SECRET = "secreto-de-prueba";
    try {
      as(null);
      const cron = (token) => new Request("https://app.test/api/news/sync", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      expect(await withFeed(() => synced(cron("secreto-de-prueba")))).toEqual(["pA", "pB"]);
      expect((await newsSync.POST(cron("otro"))).status).toBe(401);
    } finally { delete process.env.NEWS_SYNC_SECRET; }
  });
});

describe("acceso restringido a carpetas", () => {
  const ids = async () => (await (await folders.GET()).json()).folders.map((f) => f.$id).sort();

  test("un editor no permitido no ve la carpeta restringida ni su hija; responde igual que si no existiera", async () => {
    expect(await ids()).toEqual(["fA", "fOpen"]);
    expect((await files.GET(json("GET"), params({ id: "fSecret" }))).status).toBe(404);
    expect((await files.GET(json("GET"), params({ id: "fSecretChild" }))).status).toBe(404);
    expect((await file.GET(json("GET"), params({ id: "fSecret", fileId: "dSecret" }))).status).toBe(404);
    expect((await file.GET(json("GET"), params({ id: "fSecretChild", fileId: "dChild" }))).status).toBe(404);
    expect((await file.DELETE(json("DELETE"), params({ id: "fSecret", fileId: "dSecret" }))).status).toBe(404);
    expect(storageCalls.downloaded).toEqual([]);
    expect(storageCalls.deleted).toEqual([]);
    expect(store.documents.dSecret).toBeDefined();
  });

  test("no se puede escribir en una carpeta restringida sin acceso: subir, crear dentro, renombrar", async () => {
    const before = Object.keys(store.folders).length;
    const form = new FormData();
    form.set("file", new File(["x"], "intruso.pdf"));
    expect((await files.POST(new Request("https://app.test/api", { method: "POST", body: form }), params({ id: "fSecret" }))).status).toBe(404);
    expect((await folders.POST(json("POST", { name: "Intrusa", parentId: "fSecret" }))).status).toBe(400);
    expect((await folder.PATCH(json("PATCH", { name: "Pisada" }), params({ id: "fSecret" }))).status).toBe(404);
    expect((await folder.PATCH(json("PATCH", { restricted: false }), params({ id: "fSecret" }))).status).toBe(404);
    expect(Object.keys(store.folders)).toHaveLength(before);
    expect(store.folders.fSecret).toMatchObject({ name: "Secreta", restricted: true });
  });

  test("el listado global de archivos omite los de carpetas restringidas", async () => {
    expect((await (await allFiles.GET()).json()).files.map((f) => f.$id)).toEqual(["dA"]);
  });

  test("un usuario permitido ve la carpeta, su hija (heredan) y sus archivos", async () => {
    as(users.viewerA);
    expect(await ids()).toEqual(["fA", "fOpen", "fSecret", "fSecretChild"]);
    expect((await (await files.GET(json("GET"), params({ id: "fSecret" }))).json()).files.map((f) => f.$id)).toEqual(["dSecret"]);
    expect((await file.GET(json("GET"), params({ id: "fSecretChild", fileId: "dChild" }))).status).toBe(200);
    const all = (await (await allFiles.GET()).json()).files;
    expect(all.map((f) => f.$id).sort()).toEqual(["dA", "dChild", "dSecret"]);
    expect(all.find((f) => f.$id === "dChild").folderPath).toBe("Secreta / Hija secreta");
  });

  test("owner/admin ven todo; el otro workspace solo lo suyo", async () => {
    as(users.adminA);
    expect(await ids()).toEqual(["fA", "fOpen", "fSecret", "fSecretChild"]);
    as(users.ownerB);
    expect(await ids()).toEqual(["fB"]);
  });

  test("restricción heredada: una hija restringida bajo una carpeta abierta también se oculta", async () => {
    store.folders.fOpen.restricted = true;
    store.folders.fOpen.allowedUserIds = [users.viewerA.$id];
    expect(await ids()).toEqual(["fA"]);
  });

  test("restringir: el creador puede, y solo se guardan miembros activos del workspace", async () => {
    const res = await folder.PATCH(json("PATCH", { restricted: true, allowedUserIds: [users.viewerA.$id, users.ownerB.$id, "fantasma", users.viewerA.$id] }), params({ id: "fA" }));
    expect(res.status).toBe(200);
    expect(store.folders.fA).toMatchObject({ restricted: true, allowedUserIds: [users.viewerA.$id] });
  });

  test("quien no creó la carpeta ni es admin no puede cambiar su acceso", async () => {
    expect((await folder.PATCH(json("PATCH", { restricted: true }), params({ id: "fOpen" }))).status).toBe(403);
    expect(store.folders.fOpen.restricted).toBeUndefined();
  });

  test("un admin puede restringir cualquier carpeta del workspace", async () => {
    as(users.adminA);
    expect((await folder.PATCH(json("PATCH", { restricted: true, allowedUserIds: [users.editorA.$id] }), params({ id: "fOpen" }))).status).toBe(200);
    expect(store.folders.fOpen).toMatchObject({ restricted: true, allowedUserIds: [users.editorA.$id] });
  });

  test("lista de usuarios con formato inválido: 400 y sin cambios", async () => {
    expect((await folder.PATCH(json("PATCH", { restricted: true, allowedUserIds: "todos" }), params({ id: "fA" }))).status).toBe(400);
    expect((await folder.PATCH(json("PATCH", { restricted: true, allowedUserIds: [1, 2] }), params({ id: "fA" }))).status).toBe(400);
    expect(store.folders.fA.restricted).toBeUndefined();
  });
});

describe("refresco de noticias al entrar en la bandeja", () => {
  const player = { id: "pA", name: "Jugador pA", club: "Club" };
  const stale = [{ $id: "n", fetchedAt: new Date(Date.now() - 2 * 3600e3).toISOString() }];
  const fresh = [{ $id: "n", fetchedAt: new Date(Date.now() - 5 * 60e3).toISOString() }];
  const countFetches = async (run) => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("<rss><channel></channel></rss>"); };
    try { await run(); } finally { globalThis.fetch = original; }
    return calls;
  };

  test("con noticias de hace más de una hora descarga las de cada jugador", async () => {
    expect(await countFetches(() => refreshNewsIfStale({ workspaceId: "ws-stale", players: [player, { ...player, id: "pX" }], items: stale }))).toBe(2);
  });
  test("sin noticias guardadas también refresca", async () => {
    expect(await countFetches(() => refreshNewsIfStale({ workspaceId: "ws-empty", players: [player], items: [] }))).toBe(1);
  });
  test("con noticias recientes no descarga nada", async () => {
    expect(await countFetches(() => refreshNewsIfStale({ workspaceId: "ws-fresh", players: [player], items: fresh }))).toBe(0);
  });
  test("no repite el intento en menos de 15 minutos para el mismo workspace", async () => {
    expect(await countFetches(async () => {
      await refreshNewsIfStale({ workspaceId: "ws-retry", players: [player], items: stale });
      await refreshNewsIfStale({ workspaceId: "ws-retry", players: [player], items: stale });
    })).toBe(1);
  });
  test("un fallo de la fuente con un jugador no impide refrescar a los demás", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; if (calls === 1) throw new Error("sin red"); return new Response("<rss><channel></channel></rss>"); };
    try { await refreshNewsIfStale({ workspaceId: "ws-partial", players: [player, { ...player, id: "pY" }], items: stale }); } finally { globalThis.fetch = original; }
    expect(calls).toBe(2);
  });
});

describe("club del workspace y subidas a Storage", () => {
  const png = () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
  const badgeUrl = "https://r2.thesportsdb.com/images/media/team/badge/arsenal.png";
  const withFetch = async (handler, run) => {
    const original = globalThis.fetch;
    const urls = [];
    globalThis.fetch = async (url) => { urls.push(String(url)); return handler(String(url)); };
    try { await run(); } finally { globalThis.fetch = original; }
    return urls;
  };
  const search = (teams) => new Response(JSON.stringify({ teams }));
  const arsenal = [{ strTeam: "Arsenal", strSport: "Soccer", strBadge: badgeUrl }];
  const post = (name) => club.POST(json("POST", { name }));

  test("elegir un club renombra el workspace, guarda el escudo como icono y borra el anterior", async () => {
    as(users.adminA);
    let status;
    await withFetch((url) => (url.includes("searchteams") ? search(arsenal) : png()), async () => { status = (await post("Arsenal FC")).status; });
    expect(status).toBe(200);
    expect(store.workspaces.wsA.name).toBe("Arsenal FC");
    expect(store.workspaces.wsA.iconFileId).not.toBe("iconA");
    expect(storageCalls.created).toEqual([{ id: store.workspaces.wsA.iconFileId, name: "club.png", isInputFile: true }]);
    expect(storageCalls.deleted).toEqual(["iconA"]);
    expect(store.workspaces.wsB.name).toBe("B");
  });

  test("si no hay escudo, se guarda el club y se conserva el icono", async () => {
    as(users.adminA);
    await withFetch(() => search([]), async () => { expect((await (await post("Club Raro")).json()).crest).toBe(false); });
    expect(store.workspaces.wsA).toMatchObject({ name: "Club Raro", iconFileId: "iconA" });
    expect(storageCalls.created).toEqual([]);
  });

  test("si falla la búsqueda del escudo, el club se guarda igualmente", async () => {
    as(users.adminA);
    await withFetch(() => { throw new Error("sin red"); }, async () => { expect((await post("Arsenal FC")).status).toBe(200); });
    expect(store.workspaces.wsA).toMatchObject({ name: "Arsenal FC", iconFileId: "iconA" });
  });

  test("no descarga escudos de hosts no permitidos ni respuestas que no son imágenes", async () => {
    as(users.adminA);
    const urls = await withFetch(() => search([{ strTeam: "Arsenal", strSport: "Soccer", strBadge: "https://evil.test/x.png" }]), async () => { await post("Arsenal FC"); });
    expect(urls.some((url) => url.includes("evil.test"))).toBe(false);
    await withFetch((url) => (url.includes("searchteams") ? search(arsenal) : new Response("<html>", { headers: { "content-type": "text/html" } })), async () => { await post("Arsenal FC"); });
    expect(storageCalls.created).toEqual([]);
    expect(store.workspaces.wsA.iconFileId).toBe("iconA");
  });

  test("solo owner/admin pueden elegir el club y el nombre debe ser válido", async () => {
    expect((await post("Arsenal FC")).status).toBe(403);
    expect(store.workspaces.wsA.name).toBe("A");
    as(users.adminA);
    expect((await post("")).status).toBe(400);
    expect((await post("x".repeat(161))).status).toBe(400);
    as(null);
    expect((await post("Arsenal FC")).status).toBe(401);
  });

  test("subir icono envía un InputFile con extensión; SVG y GIF se rechazan", async () => {
    as(users.adminA);
    const upload = (file) => { const form = new FormData(); form.set("file", file); return icon.POST(new Request("https://app.test/api", { method: "POST", body: form })); };
    expect((await upload(new File([new Uint8Array([1, 2])], "mi.png", { type: "image/png" }))).status).toBe(200);
    expect(storageCalls.created).toEqual([expect.objectContaining({ name: "icon.png", isInputFile: true })]);
    expect((await upload(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))).status).toBe(400);
    expect((await upload(new File(["GIF"], "x.gif", { type: "image/gif" }))).status).toBe(400);
  });

  test("subir un archivo a una carpeta envía un InputFile con su nombre", async () => {
    const form = new FormData();
    form.set("file", new File(["hola"], "informe.pdf", { type: "application/pdf" }));
    expect((await files.POST(new Request("https://app.test/api", { method: "POST", body: form }), params({ id: "fA" }))).status).toBe(201);
    expect(storageCalls.created).toEqual([expect.objectContaining({ name: "informe.pdf", isInputFile: true })]);
  });
});
