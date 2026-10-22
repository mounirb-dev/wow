// fetch JSON desde el navegador contra nuestra API: lanza Error con el mensaje del servidor (y su
// código HTTP en `error.status`) si la respuesta no es 2xx, y solo lee el cuerpo como datos cuando lo es.
// Una respuesta sin cuerpo (204) devuelve null.
export async function request(url, init) {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) throw Object.assign(new Error((await response.json().catch(() => ({}))).error || "No se pudo completar la acción"), { status: response.status });
  return response.status === 204 ? null : response.json();
}
