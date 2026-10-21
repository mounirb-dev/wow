import { Query, TablesDB } from "node-appwrite";
import { unstable_cache } from "next/cache";
import { adminClient, DB } from "./appwrite.js";
import { getUser } from "./session.js";

export const WORKSPACE_ID = "default";
const roles = new Set(["owner", "admin", "editor", "viewer"]);

export async function getWorkspaceContext() {
  const user = await getUser();
  if (!user) return null;
  const db = new TablesDB(adminClient());
  let workspace;
  try {
    workspace = await db.getRow(DB, "workspaces", WORKSPACE_ID);
  } catch (error) {
    if (error.code !== 404) throw error;
    workspace = await db.createRow(DB, "workspaces", WORKSPACE_ID, { name: "AgentSolver Club", ownerId: user.$id, status: "active" });
  }

  const memberId = `${WORKSPACE_ID}_${user.$id}`;
  let member;
  try {
    member = await db.getRow(DB, "workspace_members", memberId);
  } catch (error) {
    if (error.code !== 404) throw error;
    if (workspace.ownerId === "pending") {
      member = await db.createRow(DB, "workspace_members", memberId, { workspaceId: WORKSPACE_ID, userId: user.$id, email: user.email, name: user.name || user.email, role: "owner", status: "active" });
      workspace = await db.updateRow(DB, "workspaces", WORKSPACE_ID, { ownerId: user.$id });
    } else {
      const { rows } = await db.listRows(DB, "workspace_members", [Query.equal("workspaceId", WORKSPACE_ID), Query.equal("email", user.email), Query.equal("status", "invited"), Query.limit(1)]);
      const invitation = rows[0];
      if (!invitation) return null;
      member = await db.updateRow(DB, "workspace_members", invitation.$id, { userId: user.$id, name: user.name || user.email, status: "active" });
    }
  }
  return { db, user, workspace, member };
}

export function canManage(member) {
  return member && ["owner", "admin"].includes(member.role);
}

export function canEdit(member) {
  return member && ["owner", "admin", "editor"].includes(member.role);
}

export function normalizeRole(value) {
  return roles.has(value) ? value : "viewer";
}

const listFoldersCached = unstable_cache(async () => {
  const db = new TablesDB(adminClient());
  const { rows } = await db.listRows(DB, "folders", [Query.equal("workspaceId", WORKSPACE_ID), Query.orderAsc("name"), Query.limit(500)]);
  return rows;
}, ["agentsolver-folders"], { revalidate: 60, tags: ["folders"] });

export async function listFolders() { return listFoldersCached(); }

export async function getFolder(context, id) {
  const folder = await context.db.getRow(DB, "folders", id);
  if (folder.workspaceId !== WORKSPACE_ID) throw Object.assign(new Error("Carpeta no encontrada"), { code: 404 });
  return folder;
}
