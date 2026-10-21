export async function up({ db, DB }) {
  await db.createIndex(DB, "players", "idx_workspace", "key", ["workspaceId"]);
  await db.createIndex(DB, "documents", "idx_workspace_folder", "key", ["workspaceId", "folderId"]);
  await db.createIndex(DB, "workspace_members", "idx_user", "key", ["userId"]);
  await db.createIndex(DB, "workspace_members", "idx_email_status", "key", ["email", "status"]);
  await db.createIndex(DB, "player_staff_signals", "idx_workspace_player", "key", ["workspaceId", "playerId"]);
  await db.createIndex(DB, "transfer_targets", "idx_workspace_player", "key", ["workspaceId", "playerId"]);
}
