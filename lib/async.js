// Utilidades asíncronas puras (sin dependencias de Next ni de Appwrite), fáciles de testear.

// Parte una lista en trozos de `size`. Appwrite admite como mucho 100 valores en Query.equal().
export const chunk = (items, size = 100) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

// Ejecuta fn sobre items con como mucho `limit` en paralelo, conservando el orden de salida.
// Evita tanto el bucle secuencial (lento) como un Promise.all sin tope (rate limit de Appwrite/Google).
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  // Cada "trabajador" toma el siguiente elemento cuando termina el anterior (recursión, no bucle).
  const worker = async () => {
    const i = next++;
    if (i >= items.length) return;
    results[i] = await fn(items[i]);
    await worker();
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
