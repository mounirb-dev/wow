export async function up({ db, DB }) {
  await db.createIndex(DB, "players", "idx_contract_end", "key", ["contractEnd"]);
  await db.createIndex(DB, "suitors", "idx_player", "key", ["playerId"]);
}
