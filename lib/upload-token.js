// Token firmado de una subida en curso. El servidor no guarda estado entre las peticiones de una
// subida por partes: lo validado al empezar (usuario, workspace, carpeta, nombre, tamaño y tipo) viaja
// firmado en este token y se comprueba en cada parte. Caduca (por defecto a las 6 h).
import { createHmac, timingSafeEqual } from "node:crypto";

// Clave propia derivada (con separación de dominio) para que un token MCP u otro no sirva aquí.
function key() {
  const base = process.env.UPLOAD_SECRET || process.env.MCP_OAUTH_SECRET || process.env.APPWRITE_API_KEY;
  if (!base) throw new Error("Falta UPLOAD_SECRET (o APPWRITE_API_KEY) para firmar las subidas");
  return createHmac("sha256", base).update("agentsolver:upload-token").digest();
}

const sign = (body) => createHmac("sha256", key()).update(body).digest("base64url");

export function signUpload(payload, { ttlMs = 6 * 60 * 60 * 1000, now = Date.now() } = {}) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + ttlMs })).toString("base64url");
  return `${body}.${sign(body)}`;
}

// Devuelve el contenido firmado o null si el token es ajeno, está manipulado, ha caducado o no es válido.
export function verifyUpload(token, { now = Date.now() } = {}) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof payload?.exp === "number" && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
