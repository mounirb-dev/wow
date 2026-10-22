// Migración 008_workspaces_folders: Multi-tenant: workspaces, miembros y carpetas, más el workspace "default". Sin carpetas de ejemplo: cada cuenta empieza sin carpetas.
export async function up({ db, DB, waitColumns }) {
  await db.createTable(DB, "workspaces", "Workspaces", []);
  await db.createStringColumn(DB, "workspaces", "name", 160, true);
  await db.createStringColumn(DB, "workspaces", "ownerId", 64, true);
  await db.createStringColumn(DB, "workspaces", "status", 32, true);

  await db.createTable(DB, "workspace_members", "Workspace members", []);
  await db.createStringColumn(DB, "workspace_members", "workspaceId", 64, true);
  await db.createStringColumn(DB, "workspace_members", "userId", 64, true);
  await db.createStringColumn(DB, "workspace_members", "email", 255, true);
  await db.createStringColumn(DB, "workspace_members", "name", 160, false);
  await db.createStringColumn(DB, "workspace_members", "role", 32, true);
  await db.createStringColumn(DB, "workspace_members", "status", 32, true);

  await db.createTable(DB, "folders", "Folders", []);
  await db.createStringColumn(DB, "folders", "workspaceId", 64, true);
  await db.createStringColumn(DB, "folders", "parentId", 64, false);
  await db.createStringColumn(DB, "folders", "name", 160, true);
  await db.createStringColumn(DB, "folders", "description", 500, false);
  await db.createStringColumn(DB, "folders", "kind", 32, true);
  await db.createStringColumn(DB, "folders", "createdBy", 64, true);

  await db.createTable(DB, "documents", "Documents", []);
  await db.createStringColumn(DB, "documents", "workspaceId", 64, true);
  await db.createStringColumn(DB, "documents", "folderId", 64, true);
  await db.createStringColumn(DB, "documents", "name", 255, true);
  await db.createStringColumn(DB, "documents", "mimeType", 160, false);
  await db.createStringColumn(DB, "documents", "storageFileId", 64, false);
  await db.createStringColumn(DB, "documents", "createdBy", 64, true);

  await waitColumns("workspaces");
  await waitColumns("workspace_members");
  await waitColumns("folders");
  await waitColumns("documents");

  await db.createRow(DB, "workspaces", "default", {
    name: "AgentSolver Club",
    ownerId: "pending",
    status: "active",
  });
}
