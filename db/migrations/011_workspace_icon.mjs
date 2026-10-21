// Migración 011_workspace_icon: Columna iconFileId en workspaces.
// Idempotente donde es posible: comprueba si el recurso existe antes de crearlo.
export async function up({ db, DB, waitColumns }) {
  try {
    await db.getColumn(DB, "workspaces", "iconFileId");
  } catch (error) {
    if (error.code !== 404) throw error;
    await db.createStringColumn(DB, "workspaces", "iconFileId", 64, false);
    await waitColumns("workspaces");
  }
}
