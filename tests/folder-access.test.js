import { describe, expect, test } from "bun:test";
import { accessibleFolderIds, canConfigureAccess, sanitizeAllowedUserIds } from "../lib/folder-access.js";

const folder = (id, extra = {}) => ({ $id: id, parentId: null, createdBy: "creator", ...extra });
const member = (userId, role = "editor") => ({ userId, role });
const ids = (set) => [...set].sort();

describe("accessibleFolderIds", () => {
  const tree = [folder("open"), folder("secret", { restricted: true, allowedUserIds: ["ana"] }), folder("child", { parentId: "secret" }), folder("legacy-no-fields")];

  test("owner y admin ven todo", () => {
    expect(ids(accessibleFolderIds(member("x", "owner"), tree))).toEqual(["child", "legacy-no-fields", "open", "secret"]);
    expect(ids(accessibleFolderIds(member("x", "admin"), tree))).toEqual(["child", "legacy-no-fields", "open", "secret"]);
  });
  test("un miembro permitido entra en la restringida y en sus hijas", () => expect(ids(accessibleFolderIds(member("ana"), tree))).toEqual(["child", "legacy-no-fields", "open", "secret"]));
  test("el creador entra siempre", () => expect(ids(accessibleFolderIds(member("creator"), tree))).toEqual(["child", "legacy-no-fields", "open", "secret"]));
  test("un miembro no permitido no ve la restringida ni las hijas; las abiertas sí", () => expect(ids(accessibleFolderIds(member("bea", "viewer"), tree))).toEqual(["legacy-no-fields", "open"]));
  test("una hija restringida bajo madre abierta y sus descendientes quedan ocultos", () => {
    const nested = [folder("a"), folder("b", { parentId: "a", restricted: true, allowedUserIds: [] }), folder("c", { parentId: "b" })];
    expect(ids(accessibleFolderIds(member("bea"), nested))).toEqual(["a"]);
  });
  test("padre inexistente no rompe y un ciclo se deniega", () => {
    expect(ids(accessibleFolderIds(member("bea"), [folder("x", { parentId: "ghost" })]))).toEqual(["x"]);
    expect(ids(accessibleFolderIds(member("bea"), [folder("p", { parentId: "q" }), folder("q", { parentId: "p" })]))).toEqual([]);
  });
  test("sin miembro no se ve nada restringido", () => expect(ids(accessibleFolderIds(null, tree))).toEqual(["legacy-no-fields", "open"]));
});

describe("canConfigureAccess", () => {
  test("admin/owner o creador", () => {
    expect(canConfigureAccess(member("x", "admin"), folder("f"))).toBe(true);
    expect(canConfigureAccess(member("creator"), folder("f"))).toBe(true);
    expect(canConfigureAccess(member("otro"), folder("f"))).toBe(false);
    expect(canConfigureAccess(member(undefined), { $id: "f" })).toBe(false);
  });
});

describe("sanitizeAllowedUserIds", () => {
  const members = [{ userId: "ana", status: "active" }, { userId: "bea", status: "active" }, { userId: "invite_1", status: "invited" }];
  test("deja solo miembros activos y sin duplicados", () => expect(sanitizeAllowedUserIds(["ana", "ana", "invite_1", "zoe"], members)).toEqual(["ana"]));
  test("formato inválido devuelve null", () => {
    expect(sanitizeAllowedUserIds("ana", members)).toBeNull();
    expect(sanitizeAllowedUserIds([1], members)).toBeNull();
    expect(sanitizeAllowedUserIds(Array(101).fill("ana"), members)).toBeNull();
  });
});
