import { loadPlayersFromDb } from "../lib/data.js";
import { syncPlayerNews } from "../lib/news-sync.js";

for (const player of await loadPlayersFromDb()) {
  try { console.log(player.id, await syncPlayerNews(player)); }
  catch (error) { console.error(player.id, error.message); }
}
