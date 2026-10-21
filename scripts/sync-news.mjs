// Refresca las noticias de TODOS los jugadores desde Google News RSS (`bun run news:sync`).
// Corre fuera de Next, sin sesión de usuario: por eso lee los jugadores directamente con la
// API key de admin en vez de usar loadPlayers(), que depende de las cookies de una petición.
import { TablesDB } from "node-appwrite";
import { adminClient, listAll } from "../lib/appwrite.js";
import { syncPlayerNews } from "../lib/news-sync.js";

const players = await listAll(new TablesDB(adminClient()), "players");
for (const row of players) {
  try { console.log(row.$id, await syncPlayerNews({ id: row.$id, name: row.name, club: row.club })); }
  catch (error) { console.error(row.$id, error.message); }
}
