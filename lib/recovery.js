import { createHash } from "node:crypto";
import { Account, ID, TablesDB, Users } from "node-appwrite";
import { adminClient, DB } from "@/lib/appwrite.js";

const RECOVERY_TABLE = "recovery_otps";
const RECOVERY_TTL_SECONDS = 15 * 60;

const cookieOptions = {
  httpOnly: true,
  maxAge: RECOVERY_TTL_SECONDS,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

export function hashRecoverySecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

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
