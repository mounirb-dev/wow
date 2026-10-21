// Migración 001_schema: Tablas base: players y suitors (clubes interesados en cada jugador).
export async function up({ db, DB, ensureTable, waitColumns }) {
  await ensureTable("players", "Players");
  await db.createStringColumn(DB, "players", "name", 120, true);
  await db.createStringColumn(DB, "players", "pos", 8, true);
  await db.createIntegerColumn(DB, "players", "age", true, 14, 50);
  await db.createStringColumn(DB, "players", "club", 120, true);
  await db.createDatetimeColumn(DB, "players", "contractEnd", true);
  await db.createFloatColumn(DB, "players", "value", true, 0);
  await db.createFloatColumn(DB, "players", "salary", true, 0);
  await db.createFloatColumn(DB, "players", "fair", true, 0);
  await db.createFloatColumn(DB, "players", "momentum", true, 0, 1);
  await db.createIntegerColumn(DB, "players", "seed", true);

  await ensureTable("suitors", "Suitors");
  await db.createStringColumn(DB, "suitors", "playerId", 64, true);
  await db.createStringColumn(DB, "suitors", "club", 120, true);
  await db.createIntegerColumn(DB, "suitors", "need", true, 0, 100);

  await waitColumns("players");
  await waitColumns("suitors");
}
