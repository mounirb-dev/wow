// Da de alta a un club: crea su workspace y deja invitado a su primer administrador.
// Uso:  bun run club:invite -- persona@club.com "Nombre del club"
// Producción: bun --env-file=<entorno de producción> scripts/invite-club.mjs persona@club.com "Nombre del club"
import { Query, TablesDB, Users } from "node-appwrite";
import { inviteClub } from "../lib/club-invite.js";
import { adminClient, DB } from "../lib/appwrite.js";

const [email, club] = process.argv.slice(2);
if (!email || !club) {
  console.error('Uso: bun run club:invite -- persona@club.com "Nombre del club"');
  process.exit(1);
}

const users = new Users(adminClient());
const findUser = async (address) => (await users.list([Query.equal("email", address), Query.limit(1)])).users[0] ?? null;

try {
  const result = await inviteClub({ db: new TablesDB(adminClient()), DB, email, club, findUser });
  const messages = {
    invited: "Invitado. Al entrar con ese email verificado (p. ej. con Google) verá el workspace del club.",
    active: "Ese email ya tenía una cuenta verificada: queda como propietario activo del workspace del club.",
    exists: `Sin cambios: ese email ya pertenece a un workspace (${result.workspaceId}, ${result.memberStatus}).`,
  };
  console.log(`${result.status}: ${messages[result.status]}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
