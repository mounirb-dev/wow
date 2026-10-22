// Frescura de las noticias guardadas (lógica pura). Las noticias solo se actualizan cuando algo
// ejecuta la sincronización; esto decide si vale la pena lanzarla al entrar en la bandeja.
export const NEWS_MAX_AGE_MS = 60 * 60 * 1000;
// Mínimo entre dos intentos desde la bandeja, para que muchas visitas no repitan la descarga.
export const NEWS_RETRY_MS = 15 * 60 * 1000;

// Fecha (ms) de la descarga más reciente entre las noticias, o null si no hay ninguna.
export function lastFetchedAt(items) {
  let latest = null;
  for (const item of items) {
    const time = Date.parse(item.fetchedAt);
    if (!Number.isNaN(time) && (latest === null || time > latest)) latest = time;
  }
  return latest;
}

// ¿Hay que refrescar? Sí si no hay noticias o la última descarga tiene más de una hora.
export function isNewsStale(items, now = Date.now()) {
  const latest = lastFetchedAt(items);
  return latest === null || now - latest > NEWS_MAX_AGE_MS;
}
