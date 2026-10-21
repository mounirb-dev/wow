// Migración 009_staff_recruitment_data: Valoraciones del staff (player_staff_signals) y movimientos propuestos (transfer_targets).
export async function up({ db, DB, waitColumns }) {
  await db.createTable(DB, "player_staff_signals", "Player staff signals", []);
  await db.createStringColumn(DB, "player_staff_signals", "workspaceId", 64, true);
  await db.createStringColumn(DB, "player_staff_signals", "playerId", 64, true);
  await db.createStringColumn(DB, "player_staff_signals", "userId", 64, true);
  await db.createStringColumn(DB, "player_staff_signals", "userName", 160, false);
  await db.createStringColumn(DB, "player_staff_signals", "interest", 32, true);
  await db.createStringColumn(DB, "player_staff_signals", "notes", 4000, false);
  await db.createDatetimeColumn(DB, "player_staff_signals", "updatedAt", true);

  await db.createTable(DB, "transfer_targets", "Transfer targets", []);
  await db.createStringColumn(DB, "transfer_targets", "workspaceId", 64, true);
  await db.createStringColumn(DB, "transfer_targets", "playerId", 64, true);
  await db.createStringColumn(DB, "transfer_targets", "club", 160, true);
  await db.createStringColumn(DB, "transfer_targets", "direction", 32, true);
  await db.createFloatColumn(DB, "transfer_targets", "fee", false, 0);
  await db.createFloatColumn(DB, "transfer_targets", "salary", false, 0);
  await db.createIntegerColumn(DB, "transfer_targets", "contractYears", false, 0, 10);
  await db.createStringColumn(DB, "transfer_targets", "status", 32, true);
  await db.createStringColumn(DB, "transfer_targets", "notes", 2000, false);
  await db.createStringColumn(DB, "transfer_targets", "createdBy", 64, true);
  await db.createDatetimeColumn(DB, "transfer_targets", "createdAt", true);

  await waitColumns("player_staff_signals");
  await waitColumns("transfer_targets");
}
