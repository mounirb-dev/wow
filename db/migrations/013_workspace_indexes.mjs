// Migración 013_workspace_indexes: Índices por workspaceId para que las consultas multi-tenant no escaneen la tabla.
// Idempotente donde es posible: comprueba si el recurso existe antes de crearlo.
export async function up({ db, DB }) {
  const ensureIndex = async (table, key, columns) => {
    const { indexes } = await db.listIndexes(DB, table);
    if (!indexes.some((index) => index.key === key)) await db.createIndex(DB, table, key, "key", columns);
  };
  await ensureIndex("players", "idx_workspace", ["workspaceId"]);
  await ensureIndex("documents", "idx_workspace_folder", ["workspaceId", "folderId"]);
  await ensureIndex("workspace_members", "idx_user", ["userId"]);
  await ensureIndex("workspace_members", "idx_email_status", ["email", "status"]);
  await ensureIndex("player_staff_signals", "idx_workspace_player", ["workspaceId", "playerId"]);
  await ensureIndex("transfer_targets", "idx_workspace_player", ["workspaceId", "playerId"]);
}
