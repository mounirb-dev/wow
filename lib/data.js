import { Query, TablesDB } from "node-appwrite";
import { adminClient, DB } from "./appwrite.js";

// Reads the portfolio from Appwrite (PostgreSQL). Throws if Appwrite is unreachable.
export async function loadPlayers() {
  const db = new TablesDB(adminClient());
  const [{ rows: players }, { rows: suitors }] = await Promise.all([
    db.listRows(DB, "players", [Query.limit(100)]),
    db.listRows(DB, "suitors", [Query.limit(500)]),
  ]);
  return players.map((p) => ({
    id: p.$id, name: p.name, age: p.age, pos: p.pos, club: p.club,
    contractEnd: p.contractEnd, value: p.value, salary: p.salary, fair: p.fair,
    momentum: p.momentum, seed: p.seed,
    suitors: suitors.filter((s) => s.playerId === p.$id).map((s) => ({ club: s.club, need: s.need })),
  }));
}
