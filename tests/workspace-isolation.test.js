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

// Bytes guardados en Storage por id (las partes de las subidas); sirven para leerlos de vuelta.
let storedFiles = {};

class FakeStorage {
  async createFile(_bucket, id, file) {
    storageCalls.created.push({ id, name: file?.filename, isInputFile: typeof file?.size === "function" });
    if (storedFiles[id]) throw Object.assign(new Error("already exists"), { code: 409 });
    storedFiles[id] = Buffer.from(await (await file.toFile()).arrayBuffer());
    return {};
  }
  async getFile(_bucket, id) {
    if (!storedFiles[id]) throw notFound();
    return { $id: id, sizeOriginal: storedFiles[id].length };
  }
  async deleteFile(_bucket, id) { storageCalls.deleted.push(id); delete storedFiles[id]; }
  async getFileDownload(_bucket, id) { storageCalls.downloaded.push(id); return storedFiles[id] ?? Buffer.from("contenido"); }
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
const { loadPlayerStaffData, loadStaffDataByPlayer } = await import("../lib/staff-data.js");
const { ownSignal, staffComments } = await import("../lib/staff-notes.js");
const { loadAllNews, loadPlayerNews, refreshNewsIfStale } = await import("../lib/news-sync.js");
const { listFolders, resolveWorkspaceContext } = await import("../lib/workspace.js");
const players = await import("../app/api/players/[id]/route.js");
const playersRoot = await import("../app/api/players/route.js");
const staff = await import("../app/api/players/[id]/staff/route.js");
const targets = await import("../app/api/transfer-targets/route.js");
const members = await import("../app/api/workspace/members/route.js");
const member = await import("../app/api/workspace/members/[id]/route.js");
const folders = await import("../app/api/workspace/folders/route.js");
const folder = await import("../app/api/workspace/folders/[id]/route.js");
const files = await import("../app/api/workspace/folders/[id]/files/route.js");
const upload = await import("../app/api/workspace/folders/[id]/files/upload/route.js");
const { signUpload, verifyUpload } = await import("../lib/upload-token.js");
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
  storedFiles = {};
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
});

describe("alta y baja de jugadores", () => {
  beforeEach(seed);
  const newPlayer = { name: "Nuevo Jugador", club: "Club Nuevo", pos: "ST", age: 22, contractEnd: "2029-06-30" };
  const created = async (body = newPlayer) => playersRoot.POST(json("POST", body));

  test("un editor crea un jugador en SU workspace, con datos económicos vacíos", async () => {
    const res = await created();
    expect(res.status).toBe(201);
    const { player } = await res.json();
    expect(player).toMatchObject({ workspaceId: "wsA", name: "Nuevo Jugador", pos: "FW", age: 22, value: 0, salary: 0, fair: 0, dataStatus: "manual" });
    expect((await loadPlayers()).map((item) => item.id)).toContain(player.$id);
    as(users.ownerB);
    expect((await loadPlayers()).map((item) => item.name)).not.toContain("Nuevo Jugador");
  });

  test("el viewer no puede crear y sin sesión es 401", async () => {
    as(users.viewerA);
    expect((await created()).status).toBe(403);
    as(null);
    expect((await created()).status).toBe(401);
    expect(Object.keys(store.players)).toHaveLength(2);
  });

  test("datos inválidos son 400 y un duplicado (nombre + club) es 409", async () => {
    expect((await created({ ...newPlayer, age: 5 })).status).toBe(400);
    expect((await created()).status).toBe(201);
    expect((await created({ ...newPlayer, name: "  nuevo JUGADOR " })).status).toBe(409);
    // El mismo nombre y club en OTRO workspace no choca.
    as(users.ownerB);
    expect((await created()).status).toBe(201);
  });

  test("borrar elimina el jugador y TODO lo que cuelga de él, sin tocar otros workspaces", async () => {
    store.suitors.sA2 = { $id: "sA2", playerId: "pA", club: "Otro", need: 10 };
    const res = await players.DELETE(json("DELETE"), params({ id: "pA" }));
    expect(res.status).toBe(200);
    expect(store.players.pA).toBeUndefined();
    for (const table of ["suitors", "news_items", "player_staff_signals", "transfer_targets"]) {
      expect(Object.values(store[table]).filter((row) => row.playerId === "pA")).toEqual([]);
      expect(Object.values(store[table]).filter((row) => row.playerId === "pB")).toHaveLength(1);
    }
    expect(store.players.pB).toBeDefined();
    expect((await loadPlayers()).map((item) => item.id)).toEqual([]);
  });

  test("no se puede borrar un jugador de otro workspace ni uno inexistente (mismo 404)", async () => {
    const foreign = await players.DELETE(json("DELETE"), params({ id: "pB" }));
    const missing = await players.DELETE(json("DELETE"), params({ id: "nadie" }));
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(store.players.pB).toBeDefined();
    expect(store.news_items.nB).toBeDefined();
  });

  test("el viewer no puede borrar y no se pierde nada", async () => {
    as(users.viewerA);
    expect((await players.DELETE(json("DELETE"), params({ id: "pA" }))).status).toBe(403);
    expect(store.players.pA).toBeDefined();
    expect(store.suitors.sA).toBeDefined();
  });

  test("un jugador borrado no reaparece: ni en la lista, ni en la ficha, ni en las noticias", async () => {
    await players.DELETE(json("DELETE"), params({ id: "pA" }));
    expect(await loadPlayer("pA")).toBeNull();
    expect(await loadAllNews()).toEqual([]);
    expect(await loadPlayerNews("pA")).toEqual([]);
  });
});

describe("borrar carpetas", () => {
  beforeEach(seed);
  const remove = (id) => folder.DELETE(json("DELETE"), params({ id }));

  test("un editor borra una carpeta: desaparecen la fila, sus archivos y los binarios; nada de otro workspace", async () => {
    const res = await remove("fA");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, folders: 1, files: 1 });
    expect(store.folders.fA).toBeUndefined();
    expect(store.documents.dA).toBeUndefined();
    expect(storageCalls.deleted).toEqual(["binA"]);
    expect(store.folders.fB).toBeDefined();
    expect(store.documents.dB).toBeDefined();
  });

  test("borra en cascada subcarpetas y archivos de toda la rama", async () => {
    store.folders.fKid = { $id: "fKid", workspaceId: "wsA", name: "Hija", parentId: "fOpen", createdBy: users.adminA.$id };
    store.folders.fGrandKid = { $id: "fGrandKid", workspaceId: "wsA", name: "Nieta", parentId: "fKid", createdBy: users.adminA.$id };
    store.documents.dKid = { $id: "dKid", workspaceId: "wsA", folderId: "fKid", name: "k.pdf", storageFileId: "binKid" };
    store.documents.dGrand = { $id: "dGrand", workspaceId: "wsA", folderId: "fGrandKid", name: "g.pdf", storageFileId: "binGrand" };
    const res = await remove("fOpen");
    expect(await res.json()).toMatchObject({ folders: 3, files: 2 });
    expect(["fOpen", "fKid", "fGrandKid"].filter((id) => store.folders[id])).toEqual([]);
    expect(["dKid", "dGrand"].filter((id) => store.documents[id])).toEqual([]);
    expect(storageCalls.deleted.sort()).toEqual(["binGrand", "binKid"]);
    expect(store.folders.fA).toBeDefined();
  });

  test("el viewer no puede borrar y sin sesión es 401", async () => {
    as(users.viewerA);
    expect((await remove("fA")).status).toBe(403);
    as(null);
    expect((await remove("fA")).status).toBe(401);
    expect(store.folders.fA).toBeDefined();
    expect(storageCalls.deleted).toEqual([]);
  });

  test("una carpeta de otro workspace y una inexistente dan el mismo 404", async () => {
    const foreign = await remove("fB");
    const missing = await remove("nadie");
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(store.folders.fB).toBeDefined();
    expect(store.documents.dB).toBeDefined();
  });

  test("una carpeta restringida a la que no tienes acceso es 404 y no se toca", async () => {
    expect((await remove("fSecret")).status).toBe(404);
    expect(store.folders.fSecret).toBeDefined();
    expect(store.documents.dSecret).toBeDefined();
  });

  test("si dentro hay una subcarpeta restringida que no ves, no se borra nada", async () => {
    store.folders.fHidden = { $id: "fHidden", workspaceId: "wsA", name: "Oculta", parentId: "fOpen", createdBy: users.adminA.$id, restricted: true, allowedUserIds: [] };
    const res = await remove("fOpen");
    expect(res.status).toBe(403);
    expect(store.folders.fOpen).toBeDefined();
    expect(store.folders.fHidden).toBeDefined();
    expect(storageCalls.deleted).toEqual([]);
  });

  test("un admin sí puede borrar una rama restringida entera", async () => {
    as(users.adminA);
    const res = await remove("fSecret");
    expect(await res.json()).toMatchObject({ folders: 2, files: 2 });
    expect(storageCalls.deleted.sort()).toEqual(["binChild", "binSecret"]);
    expect(store.folders.fSecretChild).toBeUndefined();
  });

  test("las carpetas de ejemplo (kind system) también se pueden borrar", async () => {
    store.folders.fSys = { $id: "fSys", workspaceId: "wsA", name: "Sistema", parentId: null, kind: "system", createdBy: "system" };
    expect((await remove("fSys")).status).toBe(200);
    expect(store.folders.fSys).toBeUndefined();
  });

  test("si el binario ya no existe en Storage, el borrado termina igualmente", async () => {
    const original = FakeStorage.prototype.deleteFile;
    FakeStorage.prototype.deleteFile = async () => { throw Object.assign(new Error("not found"), { code: 404 }); };
    try { expect((await remove("fA")).status).toBe(200); } finally { FakeStorage.prototype.deleteFile = original; }
    expect(store.documents.dA).toBeUndefined();
    expect(store.folders.fA).toBeUndefined();
  });

  test("un fallo real de Storage deja la carpeta en pie para poder reintentar", async () => {
    const original = FakeStorage.prototype.deleteFile;
    FakeStorage.prototype.deleteFile = async () => { throw Object.assign(new Error("boom"), { code: 500 }); };
    try { await expect(remove("fA")).rejects.toThrow("boom"); } finally { FakeStorage.prototype.deleteFile = original; }
    expect(store.folders.fA).toBeDefined();
    expect(store.documents.dA).toBeDefined();
  });
});

describe("cuenta nueva", () => {
  beforeEach(seed);
  test("se crea un workspace personal SIN carpetas ni jugadores de ejemplo", async () => {
    const newcomer = { $id: "u-nuevo", email: "nuevo@d.test", name: "Nuevo" };
    const context = await resolveWorkspaceContext(newcomer);
    expect(context.member.role).toBe("owner");
    expect(await listFolders(context)).toEqual([]);
    expect(await loadPlayersFor(context)).toEqual([]);
    expect(Object.values(store.folders).filter((row) => row.workspaceId === context.workspace.$id)).toEqual([]);
  });
});

describe("comentarios del staff en la ficha", () => {
  beforeEach(seed);
  const save = (body) => staff.PATCH(json("PATCH", body), params({ id: "pA" }));

  test("cada miembro conserva SU valoración y la ficha muestra la de todos con autor", async () => {
    as(users.editorA);
    expect((await save({ interest: "interested", notes: "Me encaja por la banda" })).status).toBe(200);
    as(users.adminA);
    expect((await save({ interest: "not-interested", notes: "Demasiado caro" })).status).toBe(200);

    const data = await loadPlayerStaffData("pA");
    as(users.editorA);
    expect(ownSignal(data.signals, users.editorA.$id)).toMatchObject({ interest: "interested", notes: "Me encaja por la banda" });
    expect(ownSignal(data.signals, users.adminA.$id)).toMatchObject({ interest: "not-interested", notes: "Demasiado caro" });

    const { opinions } = staffComments(data);
    expect(opinions.map((item) => [item.author, item.notes]).sort()).toEqual([["Admin A", "Demasiado caro"], ["Editor A", "Me encaja por la banda"]]);
  });

  test("guardar de nuevo actualiza la propia nota, no crea otra fila", async () => {
    as(users.editorA);
    await save({ interest: "interested", notes: "primera" });
    await save({ interest: "interested", notes: "segunda" });
    const mine = Object.values(store.player_staff_signals).filter((row) => row.playerId === "pA" && row.userId === users.editorA.$id);
    expect(mine).toHaveLength(1);
    expect(mine[0].notes).toBe("segunda");
  });

  test("los movimientos propuestos aparecen con su nota, y nada de otro workspace", async () => {
    as(users.editorA);
    await targets.POST(json("POST", { playerId: "pA", club: "Milan", fee: 5, notes: "oferta verbal" }));
    const { moves } = staffComments(await loadPlayerStaffData("pA"));
    expect(moves.map((move) => move.club)).toEqual(expect.arrayContaining(["Milan", "Visible A"]));
    expect(moves.find((move) => move.club === "Milan").notes).toBe("oferta verbal");

    // Lo de A no se ve desde B, ni lo de B desde A.
    expect(JSON.stringify(staffComments(await loadPlayerStaffData("pB")))).not.toContain("Milan");
    as(users.ownerB);
    const fromB = await loadPlayerStaffData("pA");
    expect(fromB).toEqual({ signals: [], targets: [] });
    expect(JSON.stringify(staffComments(await loadPlayerStaffData("pB")))).not.toContain("Visible A");
  });

  test("un viewer puede leer los comentarios de la ficha pero no escribir", async () => {
    as(users.editorA);
    await save({ interest: "interested", notes: "visible para todos" });
    as(users.viewerA);
    expect((await save({ interest: "interested", notes: "no" })).status).toBe(403);
    expect(staffComments(await loadPlayerStaffData("pA")).opinions.map((item) => item.notes)).toContain("visible para todos");
  });
});

describe("editar datos de un jugador", () => {
  beforeEach(seed);
  const patch = (body, id = "pA") => players.PATCH(json("PATCH", body), params({ id }));

  test("un editor guarda teléfono, email, ubicación y representante, y la ficha los expone", async () => {
    const res = await patch({ phone: "+34 600 111 222", email: "Jugador@Club.es", location: "Sevilla", agentName: "Juan Pérez", agentPhone: "+34 611 222 333" });
    expect(res.status).toBe(200);
    expect(store.players.pA).toMatchObject({ phone: "+34 600 111 222", email: "jugador@club.es", location: "Sevilla", agentName: "Juan Pérez", agentPhone: "+34 611 222 333" });
    expect(await loadPlayer("pA")).toMatchObject({ phone: "+34 600 111 222", email: "jugador@club.es", location: "Sevilla", agentName: "Juan Pérez", agentPhone: "+34 611 222 333" });
  });

  test("un jugador sin datos de contacto los expone como null, no como undefined", async () => {
    expect(await loadPlayer("pA")).toMatchObject({ phone: null, email: null, location: null, agentName: null, agentPhone: null });
  });

  test("también se editan los datos básicos y económicos", async () => {
    expect((await patch({ name: "Nombre Nuevo", club: "Otro Club", pos: "ST", age: 30, contractEnd: "2031-06-30", value: "20,5", salary: "4", fair: "18" })).status).toBe(200);
    expect(store.players.pA).toMatchObject({ name: "Nombre Nuevo", club: "Otro Club", pos: "FW", age: 30, contractEnd: "2031-06-30T00:00:00.000Z", value: 20.5, salary: 4, fair: 18 });
  });

  test("un campo vacío borra el dato", async () => {
    await patch({ phone: "+34 600 111 222" });
    expect((await patch({ phone: "" })).status).toBe(200);
    expect(store.players.pA.phone).toBeNull();
  });

  test("datos inválidos: 400 y no se guarda NADA, ni lo válido del mismo envío", async () => {
    const res = await patch({ phone: "+34 600 111 222", email: "no-es-un-email" });
    expect(res.status).toBe(400);
    expect(store.players.pA.phone).toBeUndefined();
    expect(store.players.pA.email).toBeUndefined();
  });

  test("renombrar a un jugador que ya existe (mismo nombre y club) es 409", async () => {
    store.players.pA2 = { ...store.players.pA, $id: "pA2", name: "Otro Jugador" };
    expect((await patch({ name: "  otro JUGADOR ", club: "club" })).status).toBe(409);
    expect(store.players.pA.name).toBe("Jugador pA");
    // Guardar sin cambiar nombre ni club no choca consigo mismo.
    expect((await patch({ name: "Jugador pA", phone: "+34 600 111 222" })).status).toBe(200);
  });

  test("el mismo nombre y club en otro workspace no es duplicado", async () => {
    store.players.pB.name = "Gemelo";
    store.players.pB.club = "Club X";
    expect((await patch({ name: "Gemelo", club: "Club X" })).status).toBe(200);
  });

  test("el viewer no puede editar, un jugador ajeno es 404 y sin sesión 401", async () => {
    as(users.viewerA);
    expect((await patch({ phone: "+34 600 111 222" })).status).toBe(403);
    as(users.editorA);
    expect((await patch({ phone: "+34 600 111 222" }, "pB")).status).toBe(404);
    expect(store.players.pB.phone).toBeUndefined();
    as(null);
    expect((await patch({ phone: "+34 600 111 222" })).status).toBe(401);
    expect(store.players.pA.phone).toBeUndefined();
  });

  test("no se pueden cambiar campos internos desde el cuerpo", async () => {
    expect((await patch({ workspaceId: "wsB", seed: 99, momentum: 1 })).status).toBe(400);
    expect(store.players.pA.workspaceId).toBe("wsA");
  });
});

describe("subida de archivos por partes", () => {
  beforeEach(seed);
  const MB = 1024 * 1024;
  const PART = 4 * MB;
  // Contenido con un patrón que cambia en cada byte, para comprobar que se reconstruye exacto.
  const make = (length) => Buffer.from(Uint8Array.from({ length }, (_, index) => (index * 7 + 3) % 251));
  const open = (body, id = "fA") => files.POST(json("POST", body), params({ id }));
  const put = (token, index, bytes, id = "fA") => upload.PUT(new Request(`https://app.test/api?part=${index}`, { method: "PUT", headers: { "x-upload-token": token }, body: bytes }), params({ id }));
  const finish = (token, id = "fA") => upload.POST(new Request("https://app.test/api", { method: "POST", headers: { "x-upload-token": token } }), params({ id }));
  const abort = (token, id = "fA") => upload.DELETE(new Request("https://app.test/api", { method: "DELETE", headers: { "x-upload-token": token } }), params({ id }));
  const get = (fileId, { query = "", range, id = "fA" } = {}) => file.GET(new Request(`https://app.test/api${query}`, { headers: range ? { range } : {} }), params({ id, fileId }));

  // Sube un archivo entero y devuelve { token, content, doc }.
  async function uploadWhole(content, meta = { name: "partido.mp4", type: "video/mp4" }) {
    const opened = await open({ ...meta, size: content.length });
    const { token, parts } = await opened.json();
    for (let index = 0; index < parts; index += 1) {
      const res = await put(token, index, content.subarray(index * PART, (index + 1) * PART));
      expect(res.status).toBe(200);
    }
    const done = await finish(token);
    return { token, content, res: done, doc: (await done.clone().json()).file };
  }

  test("abrir una subida devuelve token, tamaño de parte y número de partes", async () => {
    const res = await open({ name: "gol.mp4", size: PART * 2 + 1, type: "video/mp4" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ token: expect.any(String), partSize: PART, parts: 3 });
  });

  test("flujo completo con un vídeo de 9 MB: 3 partes, documento creado y contenido exacto", async () => {
    const { doc, res } = await uploadWhole(make(PART * 2 + MB));
    expect(res.status).toBe(201);
    expect(doc).toMatchObject({ name: "partido.mp4", mimeType: "video/mp4", size: PART * 2 + MB, folderId: "fA", workspaceId: "wsA", createdBy: users.editorA.$id });
    expect(doc.partIds).toBeUndefined();
    expect(doc.storageFileId).toBeUndefined();
    const row = store.documents[doc.$id];
    expect(row.partIds).toHaveLength(3);
    expect(row.partIds.map((id) => storedFiles[id].length)).toEqual([PART, PART, MB]);

    const listed = await (await files.GET(json("GET"), params({ id: "fA" }))).json();
    expect(listed.files.find((item) => item.$id === doc.$id)).toMatchObject({ size: PART * 2 + MB });
    expect(JSON.stringify(listed)).not.toContain(row.partIds[0]);
  });

  test("una foto pequeña (1 parte) y un tipo cualquiera (.zip, .exe) también se suben", async () => {
    expect((await uploadWhole(make(1000), { name: "foto.jpg", type: "image/jpeg" })).res.status).toBe(201);
    expect((await uploadWhole(make(500), { name: "datos.zip", type: "application/zip" })).res.status).toBe(201);
    expect((await uploadWhole(make(500), { name: "raro.exe", type: "" })).res.status).toBe(201);
  });

  test("el nombre se limpia: sin rutas ni caracteres de control y con tope de 255", async () => {
    const { doc } = await uploadWhole(make(10), { name: "..\\..\\etc/pass\nwd.mp4", type: "video/mp4" });
    expect(doc.name).toBe(".._.._etc_pass_wd.mp4");
    const long = await (await open({ name: `${"a".repeat(400)}.mp4`, size: 10 })).json();
    expect(verifyUpload(long.token).n.length).toBe(255);
  });

  test("abrir: rol, sesión, carpeta y datos", async () => {
    as(users.viewerA);
    expect((await open({ name: "a.mp4", size: 10 })).status).toBe(403);
    as(null);
    expect((await open({ name: "a.mp4", size: 10 })).status).toBe(401);
    as(users.editorA);
    expect((await open({ name: "a.mp4", size: 10 }, "fB")).status).toBe(404);
    expect((await open({ name: "a.mp4", size: 10 }, "fSecret")).status).toBe(404);
    expect((await open({ name: "a.mp4", size: 10 }, "nadie")).status).toBe(404);
    expect((await open({ size: 10 })).status).toBe(400);
    for (const size of [0, -5, 1.5, "mucho", null, undefined]) expect((await open({ name: "a.mp4", size })).status).toBe(400);
  });

  test("el tope por archivo se respeta (MAX_UPLOAD_MB)", async () => {
    process.env.MAX_UPLOAD_MB = "2";
    try {
      expect((await open({ name: "a.mp4", size: 3 * MB })).status).toBe(413);
      expect((await open({ name: "a.mp4", size: 2 * MB })).status).toBe(201);
    } finally { delete process.env.MAX_UPLOAD_MB; }
  });

  test("partes inválidas: índice fuera de rango y tamaño que no cuadra", async () => {
    const { token } = await (await open({ name: "a.mp4", size: PART + 10 })).json();
    expect((await put(token, 2, make(10))).status).toBe(400);
    expect((await put(token, -1, make(10))).status).toBe(400);
    expect((await put(token, 0, make(100))).status).toBe(400);
    expect((await put(token, 1, make(11))).status).toBe(400);
    expect(Object.keys(storedFiles)).toEqual([]);
  });

  test("cerrar sin todas las partes, o con una incompleta, es 409 y no crea el documento", async () => {
    const before = Object.keys(store.documents).length;
    const { token } = await (await open({ name: "a.mp4", size: PART + 10 })).json();
    expect((await finish(token)).status).toBe(409);
    expect((await put(token, 0, make(PART))).status).toBe(200);
    expect((await finish(token)).status).toBe(409);
    expect(Object.keys(store.documents)).toHaveLength(before);
  });

  test("reintentar una parte ya subida es inocuo; cerrar dos veces devuelve el mismo documento", async () => {
    const { token } = await (await open({ name: "a.mp4", size: 20 })).json();
    expect((await put(token, 0, make(20))).status).toBe(200);
    expect((await put(token, 0, make(20))).status).toBe(200);
    const first = await (await finish(token)).json();
    const second = await finish(token);
    expect(second.status).toBe(200);
    expect((await second.json()).file.$id).toBe(first.file.$id);
    expect(Object.values(store.documents).filter((row) => row.name === "a.mp4")).toHaveLength(1);
  });

  test("un token inventado, manipulado, caducado o de otra carpeta, usuario o workspace se rechaza", async () => {
    const { token } = await (await open({ name: "a.mp4", size: 20 })).json();
    const claims = verifyUpload(token);
    const forged = signUpload({ ...claims, s: 5 }).split(".")[0] + "." + token.split(".")[1];
    const expired = signUpload(claims, { ttlMs: -1000 });
    const otherFolder = signUpload({ ...claims, f: "fOpen" });
    for (const bad of ["inventado", forged, expired, otherFolder, "", "a.b"]) {
      expect((await put(bad, 0, make(20))).status).toBe(400);
      expect((await finish(bad)).status).toBe(400);
      expect((await abort(bad)).status).toBe(400);
    }
    // El token de un usuario no sirve a otro, aunque sea del mismo workspace...
    as(users.adminA);
    expect((await put(token, 0, make(20))).status).toBe(400);
    // ...ni a uno de otro workspace.
    as(users.ownerB);
    expect((await put(token, 0, make(20))).status).toBe(400);
    expect(Object.keys(storedFiles)).toEqual([]);
  });

  test("el permiso se vuelve a comprobar en cada parte: un editor degradado a viewer no puede seguir", async () => {
    const { token } = await (await open({ name: "a.mp4", size: 20 })).json();
    store.workspace_members.mEditorA.role = "viewer";
    expect((await put(token, 0, make(20))).status).toBe(403);
    expect((await finish(token)).status).toBe(403);
  });

  test("cancelar borra las partes subidas y no toca nada más; ya completada no se puede cancelar", async () => {
    const { token } = await (await open({ name: "a.mp4", size: PART + 10 })).json();
    await put(token, 0, make(PART));
    expect(Object.keys(storedFiles)).toHaveLength(1);
    expect((await abort(token)).status).toBe(200);
    expect(Object.keys(storedFiles)).toEqual([]);

    const whole = await uploadWhole(make(30));
    expect((await abort(whole.token)).status).toBe(409);
    expect(Object.keys(storedFiles)).toHaveLength(1);
  });

  test("descarga: el archivo completo llega byte a byte igual, como adjunto y con nosniff", async () => {
    const { doc, content } = await uploadWhole(make(PART * 2 + MB));
    const res = await get(doc.$id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(content.length));
    expect(res.headers.get("content-disposition")).toStartWith("attachment;");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(Buffer.from(await res.arrayBuffer()).equals(content)).toBe(true);
  });

  test("Range: un tramo que cruza dos partes, un sufijo, un tramo abierto y uno imposible", async () => {
    const { doc, content } = await uploadWhole(make(PART * 2 + MB));
    const slice = async (range) => { const res = await get(doc.$id, { range }); return { res, bytes: Buffer.from(await res.arrayBuffer()) }; };

    const cross = await slice(`bytes=${PART - 4}-${PART + 5}`);
    expect(cross.res.status).toBe(206);
    expect(cross.res.headers.get("content-range")).toBe(`bytes ${PART - 4}-${PART + 5}/${content.length}`);
    expect(cross.res.headers.get("content-length")).toBe("10");
    expect(cross.bytes.equals(content.subarray(PART - 4, PART + 6))).toBe(true);

    const tail = await slice("bytes=-100");
    expect(tail.res.status).toBe(206);
    expect(tail.bytes.equals(content.subarray(content.length - 100))).toBe(true);

    const open = await slice(`bytes=${PART * 2}-`);
    expect(open.bytes.length).toBe(MB);

    const impossible = await get(doc.$id, { range: `bytes=${content.length + 5}-` });
    expect(impossible.status).toBe(416);
    expect(impossible.headers.get("content-range")).toBe(`bytes */${content.length}`);
  });

  test("?inline=1 muestra fotos y vídeo dentro de la página, con sandbox; el resto sigue siendo descarga", async () => {
    const video = (await uploadWhole(make(50), { name: "gol.mp4", type: "video/mp4" })).doc;
    const inline = await get(video.$id, { query: "?inline=1" });
    expect(inline.headers.get("content-type")).toBe("video/mp4");
    expect(inline.headers.get("content-disposition")).toStartWith("inline;");
    expect(inline.headers.get("content-security-policy")).toBe("sandbox");

    const html = (await uploadWhole(make(50), { name: "trampa.html", type: "text/html" })).doc;
    const blocked = await get(html.$id, { query: "?inline=1" });
    expect(blocked.headers.get("content-disposition")).toStartWith("attachment;");
    expect(blocked.headers.get("content-security-policy")).toBeNull();
    expect(blocked.headers.get("x-content-type-options")).toBe("nosniff");

    const svg = (await uploadWhole(make(50), { name: "x.svg", type: "image/svg+xml" })).doc;
    expect((await get(svg.$id, { query: "?inline=1" })).headers.get("content-disposition")).toStartWith("attachment;");

    // Sin ?inline=1 un vídeo también se descarga.
    expect((await get(video.$id)).headers.get("content-disposition")).toStartWith("attachment;");
  });

  test("los archivos anteriores (un solo binario) siguen descargándose", async () => {
    const res = await get("dA");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("contenido");
    expect(storageCalls.downloaded).toEqual(["binA"]);
  });

  test("descargar exige acceso: carpeta ajena o restringida y archivo de otra carpeta son 404", async () => {
    const { doc } = await uploadWhole(make(20));
    expect((await get(doc.$id, { id: "fOpen" })).status).toBe(404);
    as(users.ownerB);
    expect((await get(doc.$id)).status).toBe(404);
    as(users.editorA);
    expect((await get("dSecret", { id: "fSecret" })).status).toBe(404);
  });

  test("borrar un archivo elimina TODAS sus partes y la fila; un viewer no puede", async () => {
    const { doc } = await uploadWhole(make(PART * 2 + 5));
    const ids = store.documents[doc.$id].partIds;
    as(users.viewerA);
    expect((await file.DELETE(json("DELETE"), params({ id: "fA", fileId: doc.$id }))).status).toBe(403);
    expect(ids.every((id) => storedFiles[id])).toBe(true);
    as(users.editorA);
    expect((await file.DELETE(json("DELETE"), params({ id: "fA", fileId: doc.$id }))).status).toBe(204);
    expect(ids.some((id) => storedFiles[id])).toBe(false);
    expect(store.documents[doc.$id]).toBeUndefined();
  });

  test("borrar una carpeta elimina también las partes de sus archivos", async () => {
    const { doc } = await uploadWhole(make(PART + 5));
    const ids = store.documents[doc.$id].partIds;
    expect((await folder.DELETE(json("DELETE"), params({ id: "fA" }))).status).toBe(200);
    expect(ids.some((id) => storedFiles[id])).toBe(false);
    expect(store.documents[doc.$id]).toBeUndefined();
    expect(storageCalls.deleted).toEqual(expect.arrayContaining(["binA", ...ids]));
  });

  test("dos subidas a la vez no se mezclan", async () => {
    const [a, b] = await Promise.all([uploadWhole(make(PART + 100), { name: "a.mp4", type: "video/mp4" }), uploadWhole(make(PART + 200), { name: "b.mp4", type: "video/mp4" })]);
    const readBack = async (doc) => Buffer.from(await (await get(doc.$id)).arrayBuffer());
    expect((await readBack(a.doc)).equals(a.content)).toBe(true);
    expect((await readBack(b.doc)).equals(b.content)).toBe(true);
  });
});

describe("subida por partes: endurecimiento", () => {
  beforeEach(seed);
  const open = (body) => files.POST(json("POST", body), params({ id: "fA" }));
  const put = (token, index, bytes, headers = {}) => upload.PUT(new Request(`https://app.test/api?part=${index}`, { method: "PUT", headers: { "x-upload-token": token, ...headers }, body: bytes }), params({ id: "fA" }));
  const finish = (token) => upload.POST(new Request("https://app.test/api", { method: "POST", headers: { "x-upload-token": token } }), params({ id: "fA" }));
  const bytes = (length) => Buffer.alloc(length, 7);

  test("con la subida ya cerrada, el mismo token no puede reescribir ni resucitar partes", async () => {
    const { token } = await (await open({ name: "a.mp4", size: 20 })).json();
    await put(token, 0, bytes(20));
    const { file: doc } = await (await finish(token)).json();
    const before = Buffer.from(storedFiles[store.documents[doc.$id].partIds[0]]);
    expect((await put(token, 0, Buffer.alloc(20, 9))).status).toBe(409);
    expect(storedFiles[store.documents[doc.$id].partIds[0]].equals(before)).toBe(true);
  });

  test("si el documento se borra después, el token tampoco puede volver a subir partes huérfanas... salvo reabrir, y cerrar lo recrea una sola vez", async () => {
    const { token } = await (await open({ name: "a.mp4", size: 20 })).json();
    await put(token, 0, bytes(20));
    const { file: doc } = await (await finish(token)).json();
    await file.DELETE(json("DELETE"), params({ id: "fA", fileId: doc.$id }));
    expect(Object.keys(storedFiles)).toEqual([]);
    // Con el documento borrado el token sigue vivo hasta que caduque: lo peor que puede hacer su dueño
    // es volver a subir lo suyo y cerrar, y queda exactamente un documento (mismo id), no duplicados.
    await put(token, 0, bytes(20));
    expect((await finish(token)).status).toBe(201);
    expect(Object.values(store.documents).filter((row) => row.name === "a.mp4")).toHaveLength(1);
  });

  test("la longitud declarada se comprueba antes de leer el cuerpo", async () => {
    const { token } = await (await open({ name: "a.mp4", size: 20 })).json();
    expect((await put(token, 0, bytes(20), { "content-length": "999999999" })).status).toBe(413);
    expect((await put(token, 0, bytes(20), { "content-length": "5" })).status).toBe(400);
    expect(Object.keys(storedFiles)).toEqual([]);
    expect((await put(token, 0, bytes(20), { "content-length": "20" })).status).toBe(200);
  });

  test("cerrar dos veces a la vez no da 500: ambos devuelven el mismo documento", async () => {
    const { token } = await (await open({ name: "a.mp4", size: 20 })).json();
    await put(token, 0, bytes(20));
    const results = await Promise.all([finish(token), finish(token)]);
    expect(results.map((res) => res.status).sort()).not.toContain(500);
    const ids = await Promise.all(results.map(async (res) => (await res.json()).file.$id));
    expect(new Set(ids).size).toBe(1);
    expect(Object.values(store.documents).filter((row) => row.name === "a.mp4")).toHaveLength(1);
  });

  test("un nombre con un sustituto UTF-16 suelto se sanea y el archivo se puede descargar", async () => {
    const { token } = await (await open({ name: "gol\ud800.mp4", size: 20 })).json();
    expect(verifyUpload(token).n.isWellFormed()).toBe(true);
    await put(token, 0, bytes(20));
    const { file: doc } = await (await finish(token)).json();
    const res = await file.GET(new Request("https://app.test/api"), params({ id: "fA", fileId: doc.$id }));
    expect(res.status).toBe(200);
  });

  test("la lista de todos los archivos tampoco filtra ids internos de Storage", async () => {
    const { token } = await (await open({ name: "a.mp4", size: 20 })).json();
    await put(token, 0, bytes(20));
    await finish(token);
    const body = await (await allFiles.GET()).json();
    const mine = body.files.find((item) => item.name === "a.mp4");
    expect(mine).toMatchObject({ folderName: "Carpeta A", downloadUrl: expect.stringContaining("/files/"), size: 20 });
    expect(mine.partIds).toBeUndefined();
    expect(mine.storageFileId).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("binA");
  });
});

describe("archivos antiguos (un solo binario): Range", () => {
  beforeEach(seed);
  const get = (range) => file.GET(new Request("https://app.test/api", { headers: range ? { range } : {} }), params({ id: "fA", fileId: "dA" }));

  test("sin Range: 200 con todo el contenido y su Content-Length", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("9");
    expect(await res.text()).toBe("contenido");
  });

  test("con Range: 206, Content-Range y solo los bytes pedidos (Safari lo exige para reproducir vídeo)", async () => {
    const res = await get("bytes=2-4");
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-4/9");
    expect(res.headers.get("content-length")).toBe("3");
    expect(await res.text()).toBe("nte");
    expect(await (await get("bytes=-3")).text()).toBe("ido");
    expect(await (await get("bytes=6-")).text()).toBe("ido");
  });

  test("un Range imposible es 416", async () => {
    const res = await get("bytes=50-");
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */9");
  });
});
