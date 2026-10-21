// Migración 012_player_workspace: players.workspaceId (aislamiento por workspace). Rellena los jugadores existentes con "default".
// Idempotente donde es posible: comprueba si el recurso existe antes de crearlo.
export async function up({ db, DB, waitColumns }) {
  try {
    await db.getColumn(DB, "players", "workspaceId");
  } catch (error) {
    if (error.code !== 404) throw error;
    await db.createStringColumn(DB, "players", "workspaceId", 64, true);
    await waitColumns("players");
  }
  const { rows } = await db.listRows(DB, "players", []);
  for (const player of rows) if (!player.workspaceId) await db.updateRow(DB, "players", player.$id, { workspaceId: "default" });
}
