// Migración 006_news_items: Tabla de noticias por jugador, pendientes de revisión del staff.
export async function up({ db, DB, ensureTable, waitColumns }) {
  await ensureTable("news_items", "News items");
  await db.createStringColumn(DB, "news_items", "playerId", 64, true);
  await db.createStringColumn(DB, "news_items", "title", 500, true);
  await db.createStringColumn(DB, "news_items", "summary", 2000, false);
  await db.createStringColumn(DB, "news_items", "url", 2000, true);
  await db.createStringColumn(DB, "news_items", "sourceName", 160, true);
  await db.createDatetimeColumn(DB, "news_items", "publishedAt", false);
  await db.createDatetimeColumn(DB, "news_items", "fetchedAt", true);
  await db.createStringColumn(DB, "news_items", "status", 40, true);
  await db.createStringColumn(DB, "news_items", "impact", 40, true);
  await db.createStringColumn(DB, "news_items", "confidence", 40, true);
  await waitColumns("news_items");
  await db.createIndex(DB, "news_items", "idx_player_published", "key", ["playerId", "publishedAt"]);
}
