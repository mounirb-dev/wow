import { Query, TablesDB } from "node-appwrite";
import { unstable_cache } from "next/cache";
import { adminClient, DB } from "./appwrite.js";

// Lectura directa para procesos externos a Next, como el sincronizador CLI.
export async function loadPlayersFromDb() {
  const db = new TablesDB(adminClient());
  const [{ rows: players }, { rows: suitors }] = await Promise.all([
    db.listRows(DB, "players", [Query.limit(100)]),
    db.listRows(DB, "suitors", [Query.limit(500)]),
  ]);
  return players.map((p) => ({
    id: p.$id, name: p.name, age: p.age, pos: p.pos, club: p.club,
    contractEnd: p.contractEnd, value: p.value, salary: p.salary, fair: p.fair,
    momentum: p.momentum, seed: p.seed,
    minutes: p.minutes ?? null, goals: p.goals ?? null, assists: p.assists ?? null,
    progressiveActions: p.progressiveActions ?? null, role: p.role ?? null,
    staffNotes: p.staffNotes ?? null, tacticalFit: p.tacticalFit ?? null,
    availability: p.availability ?? null, adaptationRisk: p.adaptationRisk ?? null,
    sourceUrl: p.sourceUrl ?? null, dataStatus: p.dataStatus ?? "pending",
    suitors: suitors.filter((s) => s.playerId === p.$id).map((s) => ({ club: s.club, need: s.need })),
  }));
}

const loadPlayersCached = unstable_cache(loadPlayersFromDb, ["agentsolver-players"], {
  revalidate: 60,
  tags: ["players"],
});

// Appwrite sigue siendo la fuente de verdad. Esta capa evita repetir la misma
// lectura en cada navegación y se invalida después de un cambio de staff.
export async function loadPlayers() {
  return loadPlayersCached();
}
