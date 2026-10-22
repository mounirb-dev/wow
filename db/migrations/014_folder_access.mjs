// Migración 014_folder_access: acceso limitado por carpeta. `restricted` activa la restricción y
// `allowedUserIds` lista los usuarios que pueden entrar (owner/admin y el creador siempre pueden).
// Idempotente donde es posible: comprueba si el recurso existe antes de crearlo.
export async function up({ db, DB, waitColumns }) {
  const ensure = async (key, create) => {
    try {
      await db.getColumn(DB, "folders", key);
    } catch (error) {
      if (error.code !== 404) throw error;
      await create();
    }
  };
  await ensure("restricted", () => db.createBooleanColumn(DB, "folders", "restricted", false, false));
  await ensure("allowedUserIds", () => db.createStringColumn(DB, "folders", "allowedUserIds", 64, false, undefined, true));
  await waitColumns("folders");
}
