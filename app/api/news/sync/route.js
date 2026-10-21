import { NextResponse } from "next/server";
import { revalidateNewsCache } from "@/lib/cache-tags.js";
import { loadPlayers } from "@/lib/data.js";
import { syncPlayerNews } from "@/lib/news-sync.js";
import { getUser } from "@/lib/session.js";

export async function POST(request) {
  const expected = process.env.NEWS_SYNC_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const authenticated = await getUser();
  if ((!expected || provided !== expected) && !authenticated) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const results = [];
  for (const player of await loadPlayers()) {
    try { results.push({ playerId: player.id, ...(await syncPlayerNews(player)) }); }
    catch (error) { results.push({ playerId: player.id, error: error.message }); }
  }
  revalidateNewsCache(results.map((result) => result.playerId));
  return NextResponse.json({ updatedAt: new Date().toISOString(), results });
}
