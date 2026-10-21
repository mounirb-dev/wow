// Migración 005_recovery_otps: Tabla de retos OTP para recuperar contraseña (guarda el hash, nunca el código).
// Idempotente donde es posible: comprueba si el recurso existe antes de crearlo.
export async function up({ db, DB, ensureTable, waitColumns }) {
  await ensureTable("recovery_otps", "Recovery OTPs");
  const existing = new Set((await db.listColumns(DB, "recovery_otps")).columns.map((column) => column.key));
  if (!existing.has("userId")) await db.createStringColumn(DB, "recovery_otps", "userId", 64, true);
  if (!existing.has("email")) await db.createStringColumn(DB, "recovery_otps", "email", 255, true);
  if (!existing.has("secretHash")) await db.createStringColumn(DB, "recovery_otps", "secretHash", 64, true);
  if (!existing.has("expiresAt")) await db.createDatetimeColumn(DB, "recovery_otps", "expiresAt", true);
  if (!existing.has("used")) await db.createBooleanColumn(DB, "recovery_otps", "used", false, false);
  await waitColumns("recovery_otps");
}
