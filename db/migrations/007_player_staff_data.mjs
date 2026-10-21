// Migración 007_player_staff_data: Campos de criterio del staff en players (minutos, encaje táctico, notas…).
export async function up({ db, DB, waitColumns }) {
  const columns = [
    ["minutes", "integer", [false]], ["goals", "integer", [false]], ["assists", "integer", [false]],
    ["progressiveActions", "integer", [false]], ["role", "string", [120, false]], ["staffNotes", "string", [4000, false]],
    ["tacticalFit", "integer", [false, 0, 100]], ["availability", "integer", [false, 0, 100]], ["adaptationRisk", "integer", [false, 0, 100]],
  ];
  for (const [key, type, args] of columns) {
    if (type === "integer") await db.createIntegerColumn(DB, "players", key, ...args);
    else await db.createStringColumn(DB, "players", key, ...args);
  }
  await waitColumns("players");
}
