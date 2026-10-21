// Valida el parámetro `next` de las redirecciones tras el login: solo rutas internas. Rechaza
// "//host" y "/\host" (que los navegadores tratan como otro origen) para evitar open-redirects.
export function safeNext(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
