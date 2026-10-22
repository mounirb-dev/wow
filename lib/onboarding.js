// Onboarding por email de quien es invitado a un workspace. Sin dependencias de Next (lo usan también los
// scripts). El email lo envía Appwrite (enlace mágico): al abrirlo, la persona pone su nombre y una contraseña
// en /onboarding y queda con la sesión iniciada. Abrir el enlace verifica su email, que es lo que activa la
// invitación (ver lib/workspace.js). El enlace caduca a la hora (límite de Appwrite): quien llegue tarde pide
// otro en la misma pantalla.
import { Account, ID } from "node-appwrite";
import { adminClient, APP_URL } from "./appwrite.js";

export const ONBOARDING_PATH = "/onboarding";
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const MAX_NAME = 128;

// Appwrite crea la cuenta (sin contraseña) si el email es nuevo y manda el enlace; si ya tiene cuenta, manda el
// enlace a esa cuenta. Lanza si Appwrite no puede enviar el email (sin SMTP, plataforma no registrada…).
export async function sendOnboardingEmail(email, account = new Account(adminClient())) {
  await account.createMagicURLToken({ userId: ID.unique(), email, url: `${APP_URL}${ONBOARDING_PATH}` });
}

// Textos de cada código de error: la URL solo lleva el código, así que nadie puede hacer que la página muestre
// un texto inventado.
export const ONBOARDING_ERRORS = {
  link: "Este enlace ya no vale (caduca a la hora y solo se usa una vez). Pide uno nuevo.",
  name: "Escribe tu nombre.",
  "name-long": `El nombre no puede pasar de ${MAX_NAME} caracteres.`,
  "password-short": `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`,
  "password-long": `La contraseña no puede pasar de ${MAX_PASSWORD} caracteres.`,
  mismatch: "Las contraseñas no coinciden.",
};

// Código de error (clave de ONBOARDING_ERRORS) o null si el nombre y la contraseña son válidos.
export function validateOnboarding({ name, password, confirm }) {
  const cleanName = String(name ?? "").trim();
  const secret = String(password ?? "");
  if (!cleanName) return "name";
  if (cleanName.length > MAX_NAME) return "name-long";
  if (secret.length < MIN_PASSWORD) return "password-short";
  if (secret.length > MAX_PASSWORD) return "password-long";
  if (secret !== String(confirm ?? "")) return "mismatch";
  return null;
}
