// Migración 002_indexes: Índices de players (fin de contrato) y suitors (por jugador).
export async function up({ db, DB }) {
  await db.createIndex(DB, "players", "idx_contract_end", "key", ["contractEnd"]);
  await db.createIndex(DB, "suitors", "idx_player", "key", ["playerId"]);
}
