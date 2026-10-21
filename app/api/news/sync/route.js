// POST /api/news/sync — refresca las noticias.
//  - Con `Authorization: Bearer $NEWS_SYNC_SECRET` (cron): todos los workspaces.
//  - Con sesión de usuario: solo los jugadores de su workspace.
// Cualquier otra llamada recibe 401.
import { NextResponse } from "next/server";
import { TablesDB } from "node-appwrite";
import { adminClient, listAll } from "@/lib/appwrite.js";
import { revalidateNewsCache } from "@/lib/cache-tags.js";
import { loadPlayers } from "@/lib/data.js";
import { mapLimit, syncPlayerNews } from "@/lib/news-sync.js";
import { getUser } from "@/lib/session.js";

export const maxDuration = 60;

export async function POST(request) {
  const expected = process.env.NEWS_SYNC_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(expected) && provided === expected;
  if (!isCron && !(await getUser())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // A scheduled call has no user session, so it refreshes every workspace; a signed-in call only its own.
  const players = isCron
    ? (await listAll(new TablesDB(adminClient()), "players")).map((row) => ({ id: row.$id, name: row.name, club: row.club }))
    : await loadPlayers();
  const results = await mapLimit(players, 4, async (player) => {
    try { return { playerId: player.id, ...(await syncPlayerNews(player)) }; }
    catch (error) { return { playerId: player.id, error: error.message }; }
  });
  revalidateNewsCache(results.map((result) => result.playerId));
  return NextResponse.json({ updatedAt: new Date().toISOString(), results });
}
