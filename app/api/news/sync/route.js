// Refresca las noticias.
//  - Cron (GET en Vercel Cron, o POST): `Authorization: Bearer <NEWS_SYNC_SECRET o CRON_SECRET>`
//    sincroniza TODOS los workspaces. No hay cron programado: lo llama un planificador externo si se quiere.
//  - POST con sesión de usuario: solo los jugadores de su workspace.
// Cualquier otra llamada recibe 401 (un GET sin el secreto del cron nunca sincroniza).
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { TablesDB } from "node-appwrite";
import { adminClient, listAll } from "@/lib/appwrite.js";
import { revalidateNewsCache } from "@/lib/cache-tags.js";
import { loadPlayers } from "@/lib/data.js";
import { mapLimit } from "@/lib/async.js";
import { syncPlayerNews } from "@/lib/news-sync.js";
import { getUser } from "@/lib/session.js";

export const maxDuration = 60;

const digest = (value) => createHash("sha256").update(value).digest();

// Comparación en tiempo constante contra los secretos configurados (Vercel Cron envía CRON_SECRET).
function isCron(request) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!provided) return false;
  return [process.env.NEWS_SYNC_SECRET, process.env.CRON_SECRET].filter(Boolean).some((secret) => timingSafeEqual(digest(provided), digest(secret)));
}

async function sync(request, { cronOnly }) {
  const cron = isCron(request);
  if (!cron && (cronOnly || !(await getUser()))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Una llamada programada no tiene sesión de usuario: refresca todos los workspaces; con sesión, solo el propio.
  const players = cron
    ? (await listAll(new TablesDB(adminClient()), "players")).map((row) => ({ id: row.$id, name: row.name, club: row.club }))
    : await loadPlayers();
  const results = await mapLimit(players, 4, async (player) => {
    try { return { playerId: player.id, ...(await syncPlayerNews(player)) }; }
    catch (error) { return { playerId: player.id, error: error.message }; }
  });
  revalidateNewsCache(results.map((result) => result.playerId));
  return NextResponse.json({ updatedAt: new Date().toISOString(), results });
}

export const POST = (request) => sync(request, { cronOnly: false });
export const GET = (request) => sync(request, { cronOnly: true });
