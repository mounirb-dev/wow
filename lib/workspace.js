import { cache } from "react";
import { Query, TablesDB } from "node-appwrite";
import { createHash } from "node:crypto";
import { adminClient, DB, listAll } from "./appwrite.js";
import { getUser } from "./session.js";

const roles = new Set(["owner", "admin", "editor", "viewer"]);

const personalWorkspaceId = (userId) => `ws_${createHash("sha256").update(userId).digest("hex").slice(0, 28)}`;
export const workspaceMemberId = (workspaceId, userId) => `member_${createHash("sha256").update(`${workspaceId}:${userId}`).digest("hex").slice(0, 28)}`;

export const getWorkspaceContext = cache(async () => {
  const user = await getUser();
  if (!user) return null;
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
});

export function canManage(member) { return member && ["owner", "admin"].includes(member.role); }
export function canEdit(member) { return member && ["owner", "admin", "editor"].includes(member.role); }
export function normalizeRole(value) { return roles.has(value) ? value : "viewer"; }

export async function listFolders(context) {
  return listAll(context.db, "folders", [Query.equal("workspaceId", context.workspace.$id), Query.orderAsc("name")]);
}

export async function getFolder(context, id) {
  const folder = await context.db.getRow(DB, "folders", id);
  if (folder.workspaceId !== context.workspace.$id) throw Object.assign(new Error("Carpeta no encontrada"), { code: 404 });
  return folder;
}
