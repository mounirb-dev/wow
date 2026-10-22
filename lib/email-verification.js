// Verificación del email de la cuenta: Appwrite manda un enlace al email actual de quien tiene la sesión y,
// al abrirlo, /api/account/email/verify lo marca como verificado. Lo usan el cambio de email y el reenvío.
import { Account } from "node-appwrite";
import { APP_URL, sessionClient } from "./appwrite.js";

export const VERIFY_PATH = "/api/account/email/verify";

// Lanza si Appwrite no puede enviar el email (sin SMTP, límite de envíos…).
export async function sendEmailVerification(sessionSecret) {
  await new Account(sessionClient(sessionSecret)).createVerification({ url: `${APP_URL}${VERIFY_PATH}` });
}
