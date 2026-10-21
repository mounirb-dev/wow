import { createHash } from "node:crypto";
import { Account, ID, TablesDB, Users } from "node-appwrite";
import { adminClient, DB } from "@/lib/appwrite.js";

// Recuperación de contraseña en 4 pasos (cada uno es una ruta en app/api/auth/recovery/*):
//  1. /recovery        pide el OTP a Appwrite y lo guarda hasheado en `recovery_otps`;
//  2. /verify-code     el usuario escribe los 6 dígitos; si el hash coincide se marca "verified";
//  3. /verify          con "verified" + el reto vigente, fija la nueva contraseña;
//  4. /resend          reemite el OTP.
// El estado viaja en cookies httpOnly; en base de datos solo queda el hash (nunca el código).
const RECOVERY_TABLE = "recovery_otps";
const RECOVERY_TTL_SECONDS = 15 * 60;

const cookieOptions = {
  httpOnly: true,
  maxAge: RECOVERY_TTL_SECONDS,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

// SHA-256 del código: lo que se guarda y se compara, nunca el código en claro.
export function hashRecoverySecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

// Guarda el reto en cookies httpOnly para que el siguiente paso lo recupere.
export function recoveryCookies(response, token, email) {
  response.cookies.set("agentsolver_recovery_user", token.userId, cookieOptions);
  response.cookies.set("agentsolver_recovery_email", email, cookieOptions);
  response.cookies.set("agentsolver_recovery_code", token.secret, cookieOptions);
  response.cookies.set("agentsolver_recovery_row", token.rowId, cookieOptions);
  return response;
}

export function clearRecoveryCookies(response) {
  for (const name of [
    "agentsolver_recovery_user",
    "agentsolver_recovery_email",
    "agentsolver_recovery_code",
    "agentsolver_recovery_row",
    "agentsolver_recovery_verified",
  ]) response.cookies.delete(name);
  return response;
}

// Pide un OTP a Appwrite y registra su hash con caducidad de 15 min. Devuelve el token + rowId.
export async function issueRecoveryChallenge(email) {
  const client = adminClient();
  const account = new Account(client);
  const users = new Users(client);
  const tables = new TablesDB(client);
  const token = await account.createRecoveryOTP({ email });

  if (!token.userId || !token.secret) throw new Error("Recovery token is incomplete");
  await users.get(token.userId);

  const row = await tables.createRow(DB, RECOVERY_TABLE, ID.unique(), {
    userId: token.userId,
    email,
    secretHash: hashRecoverySecret(token.secret),
    expiresAt: new Date(Date.now() + RECOVERY_TTL_SECONDS * 1000).toISOString(),
    used: false,
  });

  return { ...token, rowId: row.$id };
}

// Recupera el reto desde las cookies. Devuelve null si falta algo, no coincide el usuario,
// ya se usó o caducó: quien llama no necesita distinguir los casos.
export async function getRecoveryChallenge(cookies) {
  const rowId = cookies.get("agentsolver_recovery_row")?.value;
  const userId = cookies.get("agentsolver_recovery_user")?.value;
  const secret = cookies.get("agentsolver_recovery_code")?.value;
  if (!rowId || !userId || !secret) return null;

  try {
    const row = await new TablesDB(adminClient()).getRow(DB, RECOVERY_TABLE, rowId);
    if (row.userId !== userId || row.used || row.expiresAt <= new Date().toISOString()) return null;
    return { row, userId, secret };
  } catch {
    return null;
  }
}

export { cookieOptions };
