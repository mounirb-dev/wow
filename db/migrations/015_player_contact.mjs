// Migración 015_player_contact: datos de contacto y representación de cada jugador, editables desde
// la ficha (teléfono, email, ubicación, representante y su teléfono). Todos opcionales.
// Idempotente donde es posible: comprueba si el recurso existe antes de crearlo.
const COLUMNS = [["phone", 40], ["email", 255], ["location", 120], ["agentName", 120], ["agentPhone", 40]];

export async function up({ db, DB, waitColumns }) {
  for (const [key, size] of COLUMNS) {
    try {
      await db.getColumn(DB, "players", key);
    } catch (error) {
      if (error.code !== 404) throw error;
      await db.createStringColumn(DB, "players", key, size, false);
    }
  }
  await waitColumns("players");
}
