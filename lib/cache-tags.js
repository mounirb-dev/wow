// Invalidación de la caché de Next por etiquetas. `expire: 0` descarta el dato YA (no
// stale-while-revalidate): tras guardar, la siguiente navegación debe ver el cambio.
import { revalidateTag } from "next/cache";

export function revalidateFoldersCache() {
  revalidateTag("folders", { expire: 0 });
}

export function revalidatePlayersCache() {
  // Tras una edición del staff, la siguiente navegación debe ver el cambio.
  revalidateTag("players", { expire: 0 });
}

export function revalidateNewsCache(playerIds = []) {
  revalidateTag("news", { expire: 0 });
  for (const playerId of playerIds) revalidateTag(`news:${playerId}`, { expire: 0 });
}
