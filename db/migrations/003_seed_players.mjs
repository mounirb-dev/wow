import { players } from "../../lib/players.js";

export async function up({ db, DB }) {
  for (const { id, suitors, contractEnd, ...p } of players) {
    await db.createRow(DB, "players", id, { ...p, contractEnd: new Date(contractEnd).toISOString() });
    for (const s of suitors) {
      await db.createRow(DB, "suitors", `${id}_${s.club.toLowerCase().replace(/\W+/g, "")}`.slice(0, 36), { playerId: id, ...s });
    }
  }
}
