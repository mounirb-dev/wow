// Alta de un club por invitación (lógica sin Next). La herramienta es solo para clubes seleccionados:
// nadie obtiene un workspace por iniciar sesión, así que cada club nuevo se da de alta aquí con
// `bun run club:invite`. Se crea su workspace y su primer administrador como "invited"; al entrar por
// primera vez con ese email (ya verificado, p. ej. Google) la invitación se activa (ver lib/workspace.js).
import { ID, Query } from "node-appwrite";
import { clubWorkspaceId, workspaceMemberId } from "./workspace-ids.js";

const EMAIL = /^\S+@\S+\.\S+$/;

// `findUser(email)` devuelve { $id, emailVerification } de la cuenta de Appwrite de ese email o null. Solo una
// cuenta con el email verificado entra activa al momento; si no (o si no existe) queda invitada y se activa
// cuando entre con el email verificado. Idempotente: si el email ya está en algún workspace no se crea nada y
// se devuelve { status: "exists" }.
export async function inviteClub({ db, DB, email, club, findUser }) {
  const address = String(email ?? "").trim().toLowerCase();
  const name = String(club ?? "").trim();
  if (!EMAIL.test(address)) throw new Error("Introduce un email válido");
  if (!name || name.length > 160) throw new Error("Introduce el nombre del club (máximo 160 caracteres)");

  const { rows } = await db.listRows(DB, "workspace_members", [Query.equal("email", address), Query.limit(1)]);
  if (rows[0]) return { status: "exists", workspaceId: rows[0].workspaceId, memberStatus: rows[0].status };

  const account = await findUser(address);
  const invited = !account?.emailVerification;
  const userId = invited ? `invite_${ID.unique()}` : account.$id;
  const workspaceId = clubWorkspaceId(address);
  try { await db.createRow(DB, "workspaces", workspaceId, { name, ownerId: invited ? "pending" : userId, status: "active" }); }
  catch (error) { if (error.code !== 409) throw error; }
  await db.createRow(DB, "workspace_members", workspaceMemberId(workspaceId, userId), { workspaceId, userId, email: address, name: address, role: "owner", status: invited ? "invited" : "active" });
  return { status: invited ? "invited" : "active", workspaceId };
}
