// fetch JSON desde el navegador contra nuestra API: lanza Error con el mensaje del servidor si la
// respuesta no es 2xx, y solo lee el cuerpo como datos cuando lo es.
export async function request(url, init) {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "No se pudo completar la acción");
  return response.json();
}
