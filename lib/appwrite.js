import { Client, Query, Storage } from "node-appwrite";

// Cliente base apuntando al proyecto de Appwrite. Dos variantes según quién actúa:
//  - adminClient: API key de servidor, salta los permisos. Solo para código de servidor y
//    SIEMPRE tras comprobar a mano que el usuario pertenece al workspace (ver lib/workspace.js).
//  - sessionClient: actúa como el usuario (cookie de sesión); solo sirve para leer su cuenta.
const base = () => new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID);

export const adminClient = () => base().setKey(process.env.APPWRITE_API_KEY);
export const sessionClient = (secret) => base().setSession(secret);
// Identificadores configurables por entorno (ver .env.example).
export const DB = process.env.APPWRITE_DATABASE_ID ?? "agentsolver";
export const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID ?? "documents";
// Origen público de la app. Las rutas de auth lo usan para construir redirecciones absolutas.
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
export const adminStorage = () => new Storage(adminClient());

export const chunk = (items, size = 100) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

// Appwrite caps a page at 100 rows; walk the table with a cursor so lists never get silently truncated.
export async function listAll(db, table, queries = [], { max = 5000 } = {}) {
  const rows = [];
  let cursor;
  while (rows.length < max) {
    const page = await db.listRows(DB, table, [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    rows.push(...page.rows);
    if (page.rows.length < 100) break;
    cursor = page.rows.at(-1).$id;
  }
  return rows;
}
