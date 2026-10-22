import { cache } from "react";
import { Query, TablesDB } from "node-appwrite";
import { createHash } from "node:crypto";
import { adminClient, DB, listAll } from "./appwrite.js";
import { accessibleFolderIds } from "./folder-access.js";
import { getUser } from "./session.js";

// Roles de menor a mayor poder: viewer (solo lee) < editor < admin < owner.
const roles = new Set(["owner", "admin", "editor", "viewer"]);

// IDs deterministas derivados del usuario: así crear el workspace/miembro es idempotente
// (dos peticiones simultáneas no duplican filas; la segunda choca con 409/404 controlado).
// Appwrite limita los IDs a 36 caracteres, de ahí el prefijo + hash truncado.
const personalWorkspaceId = (userId) => `ws_${createHash("sha256").update(userId).digest("hex").slice(0, 28)}`;
export const workspaceMemberId = (workspaceId, userId) => `member_${createHash("sha256").update(`${workspaceId}:${userId}`).digest("hex").slice(0, 28)}`;

/**
 * Contexto de la petición: { db, user, workspace, member } o null si no hay sesión.
 *
 * Resuelve a qué workspace pertenece el usuario, en este orden:
 *  1. membresía activa existente;
 *  2. invitación pendiente por email (se activa al primer acceso);
 *  3. nada de lo anterior: se crea un workspace personal donde es owner.
 *
 * Es la puerta de seguridad de toda la app: `db` usa la API key de admin (sin permisos de
 * fila), así que cada consulta debe filtrar por `workspace.$id` y las rutas API deben
 * comprobar rol con canEdit/canManage. Cacheado por petición (React cache).
 */
export const getWorkspaceContext = cache(async () => {
  const user = await getUser();
  return user ? resolveWorkspaceContext(user) : null;
});

/**
 * Misma resolución que getWorkspaceContext pero partiendo de un usuario ya autenticado
 * ({ $id, email, name }). Es lo que usa el endpoint MCP, que se autentica con un token OAuth
 * en vez de la cookie de sesión.
 */
export async function resolveWorkspaceContext(user) {
  const db = new TablesDB(adminClient());
  const { rows: memberships } = await db.listRows(DB, "workspace_members", [Query.equal("userId", user.$id), Query.limit(20)]);
  let member = memberships.find((item) => item.status === "active");
  let workspace;

  if (member) {
    workspace = await db.getRow(DB, "workspaces", member.workspaceId);
  } else {
    const { rows: invitations } = await db.listRows(DB, "workspace_members", [Query.equal("email", user.email), Query.equal("status", "invited"), Query.limit(1)]);
    const invitation = invitations[0];
    if (invitation) {
      member = await db.updateRow(DB, "workspace_members", invitation.$id, { userId: user.$id, name: user.name || user.email, status: "active" });
      workspace = await db.getRow(DB, "workspaces", invitation.workspaceId);
    } else {
      const id = personalWorkspaceId(user.$id);
      try { workspace = await db.getRow(DB, "workspaces", id); }
      catch (error) {
        if (error.code !== 404) throw error;
        workspace = await db.createRow(DB, "workspaces", id, { name: `${user.name || user.email} · Workspace`, ownerId: user.$id, status: "active" });
      }
      const memberId = workspaceMemberId(id, user.$id);
      try { member = await db.getRow(DB, "workspace_members", memberId); }
      catch (error) {
        if (error.code !== 404) throw error;
        member = await db.createRow(DB, "workspace_members", memberId, { workspaceId: id, userId: user.$id, email: user.email, name: user.name || user.email, role: "owner", status: "active" });
      }
    }
  }
  return { db, user, workspace, member };
}

// Permisos: canManage = owner/admin (miembros, nombre, icono); canEdit además permite al editor
// tocar datos (jugadores, carpetas, archivos). El viewer solo consulta.
export function canManage(member) { return member && ["owner", "admin"].includes(member.role); }
export function canEdit(member) { return member && ["owner", "admin", "editor"].includes(member.role); }
// Cualquier valor desconocido cae al rol menos privilegiado.
export function normalizeRole(value) { return roles.has(value) ? value : "viewer"; }

// TODAS las carpetas del workspace (paginado), sin filtrar por acceso. Solo para decidir permisos
// (p. ej. distinguir "no existe" de "no tienes acceso"); para mostrar usa listFolders.
// cache(): el contexto es el mismo objeto durante la petición, así que se carga una sola vez.
export const loadAllFolders = cache(async (context) => listAll(context.db, "folders", [Query.equal("workspaceId", context.workspace.$id), Query.orderAsc("name")]));

// Carpetas del workspace a las que puede entrar el usuario (las restringidas ajenas no aparecen).
// Las carpetas "system" son las de la barra lateral.
export async function listFolders(context) {
  const all = await loadAllFolders(context);
  const allowed = accessibleFolderIds(context.member, all);
  return all.filter((folder) => allowed.has(folder.$id));
}

// Carpeta por id, verificando que es de este workspace y que el usuario puede entrar. Lanza un
// error con code 404 si no (a propósito el mismo error que "no existe", para no revelar ids de
// otros workspaces ni de carpetas restringidas).
export async function getFolder(context, id) {
  const folder = (await listFolders(context)).find((item) => item.$id === id);
  if (!folder) throw Object.assign(new Error("Carpeta no encontrada"), { code: 404 });
  return folder;
}

// Como getFolder pero devuelve null en vez de lanzar el 404.
export const findFolder = (context, id) => getFolder(context, id).catch((error) => { if (error.code === 404) return null; throw error; });
