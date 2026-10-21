import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Account } from "node-appwrite";
import { sessionClient } from "./appwrite.js";

// Cookie con el secreto de sesión de Appwrite. httpOnly: el JS del navegador nunca la lee.
export const COOKIE = "as_session";

export const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || process.env.APP_URL?.startsWith("https://"), path: "/", maxAge: 60 * 60 * 24 * 30 };

// Usuario de la sesión actual (o null). Está envuelto en cache() de React, así que dentro de una
// misma petición solo hay UNA llamada a Appwrite aunque lo pidan varios helpers.
export const getUser = cache(async () => {
  const secret = (await cookies()).get(COOKIE)?.value;
  if (!secret) return null;
  try {
    return await new Account(sessionClient(secret)).get();
  } catch {
    return null;
  }
});

// Para páginas privadas: devuelve el usuario o redirige a /login.
// Las rutas API NO usan esto: responden 401 JSON en vez de redirigir.
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
